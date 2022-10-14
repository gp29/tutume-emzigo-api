'use strict';

const config = require('./../../config');
const errors = require('./../../utils/dz-errors');
const dbConstants = require('./../../constants/db-constants');
const query = require('./../../utils/query-creator');
const rider = require('./../../models/rider');
const rider_activity = require('./../../models/rider-activity');
const _ = require('underscore');
const labels = require('./../../utils/labels.json');
const responseCodes = require('./../../utils/response-codes');
const moment = require('moment');
const timeZone = require('moment-timezone');
const fs = require('fs');
const imgHandler = require('./../../model_handlers/image-handler');
const QRCode = require('qrcode');
const LD = require('lodash');
const AWS = require('aws-sdk');
AWS.config.update({
    accessKeyId: config.aws.keyId,
    secretAccessKey: config.aws.key,
    region: config.aws.sesRegion
});
const qrcodeBucket = new AWS.S3({
    params: {
        Bucket: config.aws.s3.qrcodeBucket
    }
});

const get = async(requestParam) => {
    return new Promise(async(resolve, reject) => {
        try {
            let columnValue = {}
            if(requestParam.rider_id){
                columnValue.rider_id = requestParam.rider_id
            }
            if(requestParam.status){
                columnValue.status = requestParam.status
            }
            let response = await query.selectWithAnd(dbConstants.dbSchema.riders, columnValue, { _id: 0}, { created_at: 1 });
            if(requestParam.rider_id){
                response = response[0]
                response.profile_photo = response.profile_photo != '' ? await imgHandler.getImage({bucket: config.aws.bucketName, key:`emzigo/riders/${response.profile_photo}`}) : ''
                resolve(response);
                return;
            }
            resolve(response);
            return;
        } catch (error) {
            console.log(error)
            reject(error)
            return
        }
    })
};

const getSort = async(requestParam, req) => {
    return new Promise(async(resolve, reject) => {
        try {
            let fullUrl = req.protocol + '://' + req.get('host');
            let columnAndValue = {}
            if(requestParam.text && requestParam.text !=''){
                columnAndValue['$or'] = [{
                    rider_id: new RegExp(requestParam.text, 'i')
                }, {
                    name: new RegExp(requestParam.text, 'i')
                }, {
                    email: new RegExp(requestParam.text, 'i')
                }, {
                    mobile: new RegExp(requestParam.text, 'i')
                }];
            }
            let page = requestParam.page ? requestParam.page : 0 ;
            let sizePerPage = requestParam.sizePerPage ? requestParam.sizePerPage : 10 ;
            let skip = page * sizePerPage;
            let obj = {};

            let joinArr = [{ 
                $match : columnAndValue
            }, { 
                $sort : {created_at:-1}
            }, {
                $project: {
                    _id: 0,
                    rider_id: "$rider_id"
                }
            }];
            let count = await query.joinWithAnd(dbConstants.dbSchema.riders, joinArr);

            joinArr = [{ 
                $match : columnAndValue
            }, { 
                $sort : {created_at:-1}
            }, {
                $skip: skip
            }, {
                $limit: sizePerPage
            }, {
                $project: {
                    _id: 0,
                    rider_id: "$rider_id",
                    name: "$name",
                    email: "$email",
                    mobile: "$mobile",
                    created_at: "$created_at",
                    qrcode: "$qrcode",
                    qrcode_pdf: "$qrcode_pdf",
                }
            }];
            let data = await query.joinWithAnd(dbConstants.dbSchema.riders, joinArr);
            data = JSON.parse(JSON.stringify(data))
            _.each(data, (elem) => {
                elem.created_at = timeZone(new Date(elem.created_at)).tz(requestParam.time_zone).format('lll')
                elem.qrcode = elem.qrcode != '' ? config.aws.prefix + config.aws.s3.qrcodeBucket + '/' + elem.qrcode : ''
                //elem.qrcode_pdf = elem.qrcode_pdf != '' ? config.aws.prefix + config.aws.s3.qrcodeBucket + '/' + elem.qrcode_pdf : ''
                elem.qrcode_pdf = elem.qrcode_pdf != '' ? fullUrl+'/qrcodes/'+elem.rider_id+'.pdf' : ''
            })
            obj.data = data;
            obj.count = count.length;
            resolve(obj);
            return;
        } catch (error) {
            console.log(error)
            reject(error)
            return
        }
    })
};

const create = async(requestParam, req) => {
    return new Promise(async(resolve, reject) => {
        try {
            let response = await query.selectWithAndOne(dbConstants.dbSchema.riders, {mobile: requestParam.mobile}, { _id: 0, rider_id:1}, { created_at: 1 });
            if(response){
                reject(errors(labels.LBL_MOBILE_ALREADY_EXISTS[config.default_language], responseCodes.ResourceNotFound));
                return;
            }
            if(req.files){
                if(req.files.profile_photo){
                    requestParam.profile_photo = await imgHandler.uploadImage(req.files.profile_photo, config.aws.s3.riderBucket)
                }
            }
            let res = await query.insertSingle(dbConstants.dbSchema.riders, requestParam);
            QRCode.toDataURL(res.rider_id, async function(err, url) {
                if(err){
                    reject(errors(labels.LBL_INTERNAL_SERVER[config.default_language], responseCodes.InternalServer));
                    return;
                }
                let pdf_url = url
                let buf = new Buffer(url.replace(/^data:image\/\w+;base64,/, ""), 'base64');
                let id = Math.random().toString(36).substring(7) + moment().unix() + '.jpg';
                let data = {
                    Key: id,
                    Body: buf,
                    ContentEncoding: 'base64',
                    ContentType: 'image/jpeg',
                    ACL: 'public-read'
                };
                qrcodeBucket.putObject(data, async function(err, data) {
                    if(err){
                        reject(errors(labels.LBL_INTERNAL_SERVER[config.default_language], responseCodes.InternalServer));
                        return;
                    }
                    requestParam.qrcode = id

                    // FOR PDF CREATE
                    const PDFDocument = require('pdfkit');
                    const blobStream = require('blob-stream');
                    let pdfDoc = new PDFDocument;
                    const stream = pdfDoc.pipe(blobStream());
                    pdfDoc.pipe(fs.createWriteStream('./public/qrcodes/'+res.rider_id+'.pdf'));
                    pdfDoc.fontSize(25).text(requestParam.name, {align:'center'})
                    pdfDoc.image(pdf_url, {width: 400, height:400, align:'center', valign:'center'});
                    pdfDoc.end();
                    // FOR PDF CREATE
                    stream.on('finish', async function() {
                        requestParam.qrcode_pdf = await imgHandler.uploadPdf('./public/qrcodes/'+res.rider_id+'.pdf', config.aws.s3.qrcodeBucket)
                        await query.updateSingle(dbConstants.dbSchema.riders, requestParam, {rider_id: res.rider_id});
                        //fs.unlinkSync('./public/qrcodes/'+res.rider_id+'.pdf')
                        resolve({});
                        return;
                    });
                })
            });
        } catch (error) {
            console.log(error)
            reject(error)
            return
        }
    })
};

const update = async(requestParam, req) => {
    return new Promise(async(resolve, reject) => {
        try {
            let compareColumnAndValues = {
                rider_id: { $ne: requestParam.rider_id },
                mobile: requestParam.mobile, 
            };
            let response = await query.selectWithAndOne(dbConstants.dbSchema.riders, compareColumnAndValues, { _id: 0, rider_id:1}, { created_at: 1 });
            if(response){
                reject(errors(labels.LBL_MOBILE_ALREADY_EXISTS[config.default_language], responseCodes.ResourceNotFound));
                return;
            }
            let rider = await query.selectWithAndOne(dbConstants.dbSchema.riders, {rider_id: requestParam.rider_id}, { _id: 0, profile_photo:1}, { created_at: 1 });
            if (requestParam.change_logo) {
                const objects = [{
                    Key: `emzigo/riders/${rider.profile_photo}`
                }];
                await imgHandler.deleteImage(objects, config.aws.bucketName)
                requestParam.profile_photo = await imgHandler.uploadImage(req.files.profile_photo, config.aws.s3.riderBucket)
            }
            else{
                delete requestParam.profile_photo
            }
            delete requestParam.qrcode
            delete requestParam.qrcode_pdf
            await query.updateSingle(dbConstants.dbSchema.riders, requestParam, {rider_id: requestParam.rider_id});
            resolve({});
            return;
        } catch (error) {
            reject(error)
            return
        }
    })
};

const action = async(requestParam) => {
    return new Promise(async(resolve, reject) => {
        try {
            if (requestParam['type']== "delete") {
                let objects = []
                let response = await query.selectWithAnd(dbConstants.dbSchema.riders, {rider_id: {$in: requestParam.ids}}, { _id: 0, rider_id:1, qrcode:1, qrcode_pdf:1, profile_photo:1}, { created_at: 1 });
                await Promise.all(response.map(async (elem) => {
                    objects = [{
                        Key: `emzigo/qrcodes/${elem.qrcode}`
                    }, {
                        Key: `emzigo/qrcodes/${elem.qrcode_pdf}`
                    }, {
                        Key: `emzigo/riders/${elem.profile_photo}`
                    }];
                    fs.unlinkSync('./public/qrcodes/'+elem.rider_id+'.pdf')
                }))
                await imgHandler.deleteImage(objects, config.aws.bucketName)
                await query.removeMultiple(dbConstants.dbSchema.riders, { rider_id: { $in: requestParam['ids']}});
            }
            else{
                await query.updateMultiple(dbConstants.dbSchema.riders, {status: requestParam.type}, {rider_id: { $in: requestParam['ids']}});
            }
            resolve({});
            return;
        } catch (error) {
            reject(error)
            return
        }
    })
};

const getAccount = async(requestParam, req) => {
    return new Promise(async(resolve, reject) => {
        try {
            let fullUrl = req.protocol + '://' + req.get('host');
            let columnAndValue = {}
            if(requestParam.text && requestParam.text !=''){
                columnAndValue['$or'] = [{
                    rider_id: new RegExp(requestParam.text, 'i')
                }, {
                    name: new RegExp(requestParam.text, 'i')
                }, {
                    mobile: new RegExp(requestParam.text, 'i')
                }];
            }
            let page = requestParam.page ? requestParam.page : 0 ;
            let sizePerPage = requestParam.sizePerPage ? requestParam.sizePerPage : 10 ;
            let skip = page * sizePerPage;
            let obj = {};

            let joinArr = [{ 
                $match : columnAndValue
            }, { 
                $sort : {created_at:-1}
            }, {
                $project: {
                    _id: 0,
                    rider_id: "$rider_id"
                }
            }];
            let count = await query.joinWithAnd(dbConstants.dbSchema.riders, joinArr);

            joinArr = [{ 
                $match : columnAndValue
            }, { 
                $sort : {created_at:-1}
            }, {
                $skip: skip
            }, {
                $limit: sizePerPage
            }, {
                $project: {
                    _id: 0,
                    rider_id: 1,
                    name: 1,
                    total_balance: 1,
                    mobile: 1,
                }
            }];
            let data = await query.joinWithAnd(dbConstants.dbSchema.riders, joinArr);
            data = JSON.parse(JSON.stringify(data))
            _.each(data, (elem) => {
                elem.total_balance = elem.total_balance+' TZS'
            })
            obj.data = data;
            obj.count = count.length;
            resolve(obj);
            return;
        } catch (error) {
            console.log(error)
            reject(error)
            return
        }
    })
};

const updateBalance = async(requestParam) => {
    return new Promise(async(resolve, reject) => {
        try {
            await query.updateSingle(dbConstants.dbSchema.riders, {$inc:{total_balance: parseFloat(requestParam.total_balance)}}, {rider_id: requestParam.rider_id});
            requestParam.type = 'add'
            requestParam.amount = requestParam.total_balance
            requestParam.by_whom = 'admin'
            requestParam.by_whom_id = requestParam.user_id
            await query.insertSingle(dbConstants.dbSchema.rider_activities, requestParam);
            resolve({});
            return;
        } catch (error) {
            reject(error)
            return
        }
    })
};

const getStatement = async(requestParam, req) => {
    return new Promise(async(resolve, reject) => {
        try {
            let fullUrl = req.protocol + '://' + req.get('host');
            let columnAndValue = {rider_id: requestParam.rider_id}
            if(requestParam.text && requestParam.text !=''){
                columnAndValue['$or'] = [{
                    activity_id: new RegExp(requestParam.text, 'i')
                }, {
                    type: new RegExp(requestParam.text, 'i')
                }, {
                    "branchDetails.branch_name": new RegExp(requestParam.text, 'i')
                }];
            }
            let page = requestParam.page ? requestParam.page : 0 ;
            let sizePerPage = requestParam.sizePerPage ? requestParam.sizePerPage : 10 ;
            let skip = page * sizePerPage;
            let obj = {};

            let joinArr = [{
                $lookup: {
                    from: 'branches',
                    localField: 'branch_id',
                    foreignField: 'branch_id',
                    as: 'branchDetails',
                },
            }, {
                "$unwind": {
                    "path": "$branchDetails",
                    "preserveNullAndEmptyArrays": true
                }
            }, { 
                $match : columnAndValue
            }, { 
                $sort : {created_at:-1}
            }, {
                $project: {
                    _id: 0,
                    rider_id: "$rider_id"
                }
            }];
            let count = await query.joinWithAnd(dbConstants.dbSchema.rider_activities, joinArr);

            joinArr = [{
                $lookup: {
                    from: 'branches',
                    localField: 'branch_id',
                    foreignField: 'branch_id',
                    as: 'branchDetails',
                },
            }, {
                "$unwind": {
                    "path": "$branchDetails",
                    "preserveNullAndEmptyArrays": true
                }
            }, { 
                $match : columnAndValue
            }, { 
                $sort : {created_at:-1}
            }, {
                $skip: skip
            }, {
                $limit: sizePerPage
            }, {
                $project: {
                    _id: 0,
                    activity_id: 1,
                    type: 1,
                    amount: 1,
                    created_at: 1,
                    branch: "$branchDetails",
                }
            }];
            let data = await query.joinWithAnd(dbConstants.dbSchema.rider_activities, joinArr);
            data = JSON.parse(JSON.stringify(data))
            await Promise.all(data.map(async (elem) => {
                if(elem.branch){
                    elem.branch = elem.branch.branch_name
                }
                else{
                    elem.branch = 'Admin'
                }
                elem.amount = elem.amount+' TZS'
                elem.type = LD.upperFirst(elem.type)
                elem.created_at = timeZone(new Date(elem.created_at)).tz(requestParam.time_zone).format('lll')
            }))
            obj.data = data;
            obj.count = count.length;

            let response = await query.selectWithAndOne(dbConstants.dbSchema.riders, {rider_id: requestParam.rider_id}, { _id: 0, rider_id:1, name:1, total_balance:1, used_balance:1}, { created_at: 1 });
            obj.rider_info = response ? response : {}

            resolve(obj);
            return;
        } catch (error) {
            console.log(error)
            reject(error)
            return
        }
    })
};

const settlement = async(requestParam,)=> {
    return new Promise(async(resolve, reject) => {
        try {
            await query.updateSingle(dbConstants.dbSchema.riders, {used_balance:0}, {rider_id: requestParam.rider_id});
            resolve({});
            return;
        } catch (error) {
            console.log(error)
            reject(error)
            return
        }
    })
};

module.exports = {
    get,
    getSort,
    create,
    update,
    action,
    getAccount,
    updateBalance,
    getStatement,
    settlement
};