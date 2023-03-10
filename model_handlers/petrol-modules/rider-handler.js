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
const idGenerator = require('./../../utils/id-generator');
const encryptDecryptHandler = require('./../../model_handlers/encrypt-decrypt-handler');
const passwordHandler = require('./../../utils/password-handler');
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
                response.driving_license = response.driving_license != '' ? await imgHandler.getImage({bucket: config.aws.bucketName, key:`emzigo/riders/${response.driving_license}`}) : ''
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
            if(requestParam.checklist_percentage && requestParam.checklist_percentage != ''){
                columnAndValue.checklist_percentage = {$eq: parseFloat(requestParam.checklist_percentage)}
            }
            if(requestParam.start_date && requestParam.end_date != ''){
                let start_date = timeZone(new Date(requestParam.start_date)).tz(requestParam.time_zone).format('YYYY-MM-DD')
                let end_date = timeZone(new Date(requestParam.end_date)).tz(requestParam.time_zone).format('YYYY-MM-DD')
                for(var arr=[],dt=new Date(start_date); dt<=new Date(end_date); dt.setDate(dt.getDate()+1)){
                    arr.push(moment(new Date(dt)).format('YYYY-MM-DD'));
                }
                columnAndValue.followup_date = {$in:arr}
            }
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
                    account_number: "$account_number",
                    pin: "$pin",
                    vehicle_id: "$vehicle_id",
                    followup_date: "$followup_date",
                    checklist_percentage: "$checklist_percentage",
                    // qrcode: "$qrcode",
                    // qrcode_pdf: "$qrcode_pdf",
                }
            }];
            let data = await query.joinWithAnd(dbConstants.dbSchema.riders, joinArr);
            data = JSON.parse(JSON.stringify(data))
            await Promise.all(data.map(async (elem) => {
                elem.checklist_percentage = elem.checklist_percentage ? elem.checklist_percentage+'%' : ''
                elem.created_at = timeZone(new Date(elem.created_at)).tz(requestParam.time_zone).format('lll')
                // elem.qrcode = elem.qrcode != '' ? config.aws.prefix + config.aws.s3.qrcodeBucket + '/' + elem.qrcode : ''
                // //elem.qrcode_pdf = elem.qrcode_pdf != '' ? config.aws.prefix + config.aws.s3.qrcodeBucket + '/' + elem.qrcode_pdf : ''
                // elem.qrcode_pdf = elem.qrcode_pdf != '' ? fullUrl+'/qrcodes/'+elem.rider_id+'.pdf' : ''
                let vehicle = await query.selectWithAndOne(dbConstants.dbSchema.panda_vehicles, {vehicle_id: elem.vehicle_id}, { _id: 0, name:1}, { created_at: 1 });
                elem.vehicle_name = vehicle ? vehicle.name : ''
            }))
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
                if(req.files.driving_license){
                    requestParam.driving_license = await imgHandler.uploadImage(req.files.driving_license, config.aws.s3.riderBucket)
                }
            }
            if(requestParam.followup_date){
                requestParam.followup_date = timeZone(new Date(requestParam.followup_date)).tz(requestParam.time_zone).format('YYYY-MM-DD')
            }
            let checklists = await query.selectWithAnd(dbConstants.dbSchema.checklists, {checklist_id:{$in: requestParam.checklist_id}}, { _id: 0, checklist_id:1, percentage:1}, { created_at: 1 });
            let checklist_percentage = 0
            _.each(checklists, (elem) => {
                checklist_percentage += parseFloat(elem.percentage)
            })
            requestParam.checklist_percentage = checklist_percentage
            requestParam.account_number = await generateAccountNumber();
            requestParam.password = await passwordHandler.encrypt(requestParam.password.toString());
            let res = await query.insertSingle(dbConstants.dbSchema.riders, requestParam);
            resolve({});
            return;
            // QRCode.toDataURL(res.rider_id, async function(err, url) {
            //     if(err){
            //         reject(errors(labels.LBL_INTERNAL_SERVER[config.default_language], responseCodes.InternalServer));
            //         return;
            //     }
            //     let pdf_url = url
            //     let buf = new Buffer(url.replace(/^data:image\/\w+;base64,/, ""), 'base64');
            //     let id = Math.random().toString(36).substring(7) + moment().unix() + '.jpg';
            //     let data = {
            //         Key: id,
            //         Body: buf,
            //         ContentEncoding: 'base64',
            //         ContentType: 'image/jpeg',
            //         ACL: 'public-read'
            //     };
            //     qrcodeBucket.putObject(data, async function(err, data) {
            //         if(err){
            //             reject(errors(labels.LBL_INTERNAL_SERVER[config.default_language], responseCodes.InternalServer));
            //             return;
            //         }
            //         requestParam.qrcode = id

            //         // FOR PDF CREATE
            //         const PDFDocument = require('pdfkit');
            //         const blobStream = require('blob-stream');
            //         let pdfDoc = new PDFDocument;
            //         const stream = pdfDoc.pipe(blobStream());
            //         pdfDoc.pipe(fs.createWriteStream('./public/qrcodes/'+res.rider_id+'.pdf'));
            //         pdfDoc.fontSize(25).text(requestParam.name, {align:'center'})
            //         pdfDoc.image(pdf_url, {width: 400, height:400, align:'center', valign:'center'});
            //         pdfDoc.end();
            //         // FOR PDF CREATE
            //         stream.on('finish', async function() {
            //             requestParam.qrcode_pdf = await imgHandler.uploadPdf('./public/qrcodes/'+res.rider_id+'.pdf', config.aws.s3.qrcodeBucket)
            //             await query.updateSingle(dbConstants.dbSchema.riders, requestParam, {rider_id: res.rider_id});
            //             //fs.unlinkSync('./public/qrcodes/'+res.rider_id+'.pdf')
            //             resolve({});
            //             return;
            //         });
            //     })
            // });
        } catch (error) {
            console.log(error)
            reject(error)
            return
        }
    })
};

const generateAccountNumber = async() => {
    return new Promise(async(resolve, reject) => {
        try {
            let account_number = await idGenerator.generateString(5, true, false, false); 
            let response = await query.selectWithAndOne(dbConstants.dbSchema.riders, {account_number}, { _id: 0}, { created_at: 1 });
            if(response){
                resolve(generateAccountNumber());
                return;
            }else{
                resolve(account_number);
                return;
            }
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
            let rider = await query.selectWithAndOne(dbConstants.dbSchema.riders, {rider_id: requestParam.rider_id}, { _id: 0, profile_photo:1, driving_license:1, account_number:1}, { created_at: 1 });
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
            if (requestParam.change_license) {
                const objects = [{
                    Key: `emzigo/riders/${rider.driving_license}`
                }];
                await imgHandler.deleteImage(objects, config.aws.bucketName)
                requestParam.driving_license = await imgHandler.uploadImage(req.files.driving_license, config.aws.s3.riderBucket)
            }
            else{
                delete requestParam.driving_license
            }
            delete requestParam.qrcode
            delete requestParam.qrcode_pdf
            if(!rider.account_number || rider.account_number == 0){
                requestParam.account_number = await generateAccountNumber();
            }
            if(requestParam.followup_date){
                requestParam.followup_date = timeZone(new Date(requestParam.followup_date)).tz(requestParam.time_zone).format('YYYY-MM-DD')
            }
            let checklists = await query.selectWithAnd(dbConstants.dbSchema.checklists, {checklist_id:{$in: requestParam.checklist_id}}, { _id: 0, checklist_id:1, percentage:1}, { created_at: 1 });
            let checklist_percentage = 0
            _.each(checklists, (elem) => {
                checklist_percentage += parseFloat(elem.percentage)
            })
            requestParam.checklist_percentage = checklist_percentage
            await query.updateSingle(dbConstants.dbSchema.riders, requestParam, {rider_id: requestParam.rider_id});
            resolve({});
            return;
        } catch (error) {
            console.log(error)
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
                let response = await query.selectWithAnd(dbConstants.dbSchema.riders, {rider_id: {$in: requestParam.ids}}, { _id: 0, rider_id:1, qrcode:1, qrcode_pdf:1, profile_photo:1, driving_license:1}, { created_at: 1 });
                await Promise.all(response.map(async (elem) => {
                    objects = [{
                        Key: `emzigo/qrcodes/${elem.qrcode}`
                    }, {
                        Key: `emzigo/qrcodes/${elem.qrcode_pdf}`
                    }, {
                        Key: `emzigo/riders/${elem.profile_photo}`
                    }, {
                        Key: `emzigo/riders/${elem.driving_license}`
                    }];
                    //fs.unlinkSync('./public/qrcodes/'+elem.rider_id+'.pdf')
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
                    percentage: 1,
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
                if(!elem.percentage){
                    elem.percentage = ''
                }
            }))
            obj.data = data;
            obj.count = count.length;

            if(requestParam.from && requestParam.from == 'new'){
                let settings = await query.selectWithAndOne(dbConstants.dbSchema.settings, {}, { _id:0} );
                let activities = await query.selectWithAnd(dbConstants.dbSchema.rider_activities, {rider_id: requestParam.rider_id, type:'deduct', is_settlement:false}, { _id: 0}, { created_at: -1 });
                let admin_cost = 0
                let rider_pay_cost = 0
                await Promise.all(activities.map(async (elem) => {
                    admin_cost += parseFloat(elem.admin_cost)
                }));

                let response = await query.selectWithAndOne(dbConstants.dbSchema.riders, {rider_id: requestParam.rider_id}, { _id: 0, rider_id:1, name:1, total_balance:1, used_balance:1}, { created_at: -1 });
                if(response){
                    response = JSON.parse(JSON.stringify(response))
                    response.admin_cost = parseFloat(parseFloat(admin_cost).toFixed(2))
                    response.rider_pay_cost = parseFloat(parseFloat(response.used_balance) + response.admin_cost).toFixed(2)
                }
                obj.rider_info = response ? response : {}
            }
            else{
                let response = await query.selectWithAndOne(dbConstants.dbSchema.riders, {rider_id: requestParam.rider_id}, { _id: 0, rider_id:1, name:1, total_balance:1, used_balance:1}, { created_at: -1 });
                obj.rider_info = response ? response : {}
            }

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
            if(parseFloat(requestParam.total_amount_to_pay) == parseFloat(requestParam.amount)){
                await query.updateSingle(dbConstants.dbSchema.riders, {used_balance: 0}, {rider_id: requestParam.rider_id});
                await query.updateMultiple(dbConstants.dbSchema.rider_activities, {is_settlement: true}, {rider_id: { $in: requestParam['rider_id']}});
            }
            else{
                await query.updateSingle(dbConstants.dbSchema.riders, {$inc:{used_balance: -parseFloat(requestParam.amount)}}, {rider_id: requestParam.rider_id});
            }
            requestParam.type = 'paid'
            requestParam.by_whom = 'rider'
            requestParam.by_whom_id = requestParam.rider_id
            await query.insertSingle(dbConstants.dbSchema.rider_activities, requestParam);
            resolve({});
            return;
        } catch (error) {
            console.log(error)
            reject(error)
            return
        }
    })
};

const getReport = async(requestParam) => {
    return new Promise(async(resolve, reject) => {
        try {
            let columnAndValue = {}
            if(requestParam.region_id && requestParam.region_id != ''){
                columnAndValue.region_id = requestParam.region_id
            }
            if(requestParam.kijiwe_id && requestParam.kijiwe_id != ''){
                columnAndValue.kijiwe_id = requestParam.kijiwe_id
            }
            if(requestParam.vehicle_id && requestParam.vehicle_id != ''){
                columnAndValue.vehicle_id = requestParam.vehicle_id
            }
            if(requestParam.text && requestParam.text !=''){
                columnAndValue['$or'] = [{
                    rider_id: new RegExp(requestParam.text, 'i')
                }, {
                    name: new RegExp(requestParam.text, 'i')
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
                    rider_id:1,
                    name:1,
                    region_id:1,
                    vehicle_id:1,
                    kijiwe_id:1,
                }
            }];
            let data = await query.joinWithAnd(dbConstants.dbSchema.riders, joinArr);
            data = JSON.parse(JSON.stringify(data))
            await Promise.all(data.map(async (elem) => {
                let region = await query.selectWithAndOne(dbConstants.dbSchema.regions, {region_id: elem.region_id}, { _id: 0, name:1}, { created_at: 1 });
                elem.region = region ? region.name : ''

                let vehicle = await query.selectWithAndOne(dbConstants.dbSchema.panda_vehicles, {vehicle_id: elem.vehicle_id}, { _id: 0, name:1}, { created_at: 1 });
                elem.vehicle = vehicle ? vehicle.name : ''

                let kijiwe = await query.selectWithAndOne(dbConstants.dbSchema.kijiwes, {kijiwe_id: elem.kijiwe_id}, { _id: 0, name:1}, { created_at: 1 });
                elem.kijiwe = kijiwe ? kijiwe.name : ''

                let obj = {rider_id: elem.rider_id, type:'deduct', is_settlement:false}
                if(requestParam.start_date && requestParam.end_date){
                    let start_date = timeZone(new Date(requestParam.start_date)).tz(requestParam.time_zone).format('YYYY-MM-DD')
                    let end_date = timeZone(new Date(requestParam.end_date)).tz(requestParam.time_zone).format('YYYY-MM-DD')
                    obj.created_at = {
                        $lte: new Date(end_date+'T23:59:59.000Z'),
                        $gte: new Date(start_date+'T00:00:00.000Z')
                    }
                }
                let activities = await query.selectWithAnd(dbConstants.dbSchema.rider_activities, obj, { _id: 0}, { created_at: -1 });
                let admin_cost = 0
                let used_amount = 0
                await Promise.all(activities.map(async (elem) => {
                    admin_cost += parseFloat(elem.admin_cost)
                    used_amount += parseFloat(elem.amount)
                }));

                elem.used_amount = parseFloat(used_amount).toFixed(2)+' TZS'
                elem.admin_cost = parseFloat(admin_cost).toFixed(2)+' TZS'
            }))
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

const getReportXlsx = async(requestParam) => {
    return new Promise(async(resolve, reject) => {
        try {
            let columnAndValue = {}
            if(requestParam.region_id && requestParam.region_id != ''){
                columnAndValue.region_id = requestParam.region_id
            }
            if(requestParam.kijiwe_id && requestParam.kijiwe_id != ''){
                columnAndValue.kijiwe_id = requestParam.kijiwe_id
            }
            if(requestParam.vehicle_id && requestParam.vehicle_id != ''){
                columnAndValue.vehicle_id = requestParam.vehicle_id
            }
            let joinArr = [{ 
                $match : columnAndValue
            }, { 
                $sort : {created_at:-1}
            }, {
                $project: {
                    _id: 0,
                    rider_id:1,
                    name:1,
                    region_id:1,
                    vehicle_id:1,
                    kijiwe_id:1,
                }
            }];
            let data = await query.joinWithAnd(dbConstants.dbSchema.riders, joinArr);
            data = JSON.parse(JSON.stringify(data))
            await Promise.all(data.map(async (elem) => {
                let region = await query.selectWithAndOne(dbConstants.dbSchema.regions, {region_id: elem.region_id}, { _id: 0, name:1}, { created_at: 1 });
                elem.region = region ? region.name : ''

                let vehicle = await query.selectWithAndOne(dbConstants.dbSchema.panda_vehicles, {vehicle_id: elem.vehicle_id}, { _id: 0, name:1}, { created_at: 1 });
                elem.vehicle = vehicle ? vehicle.name : ''

                let kijiwe = await query.selectWithAndOne(dbConstants.dbSchema.kijiwes, {kijiwe_id: elem.kijiwe_id}, { _id: 0, name:1}, { created_at: 1 });
                elem.kijiwe = kijiwe ? kijiwe.name : ''

                let obj = {rider_id: elem.rider_id, type:'deduct', is_settlement:false}
                if(requestParam.start_date && requestParam.end_date){
                    let start_date = timeZone(new Date(requestParam.start_date)).tz(requestParam.time_zone).format('YYYY-MM-DD')
                    let end_date = timeZone(new Date(requestParam.end_date)).tz(requestParam.time_zone).format('YYYY-MM-DD')
                    obj.created_at = {
                        $lte: new Date(end_date+'T23:59:59.000Z'),
                        $gte: new Date(start_date+'T00:00:00.000Z')
                    }
                }
                let activities = await query.selectWithAnd(dbConstants.dbSchema.rider_activities, obj, { _id: 0}, { created_at: -1 });
                let admin_cost = 0
                let used_amount = 0
                await Promise.all(activities.map(async (elem) => {
                    admin_cost += parseFloat(elem.admin_cost)
                    used_amount += parseFloat(elem.amount)
                }));

                elem.used_amount = parseFloat(used_amount).toFixed(2)+' TZS'
                elem.admin_cost = parseFloat(admin_cost).toFixed(2)+' TZS'
            }))
            resolve(data);
            return;
        } catch (error) {
            console.log(error)
            reject(error)
            return
        }
    })
};

const changePassword = async(requestParam) => {
    return new Promise(async(resolve, reject) => {
        try {
            let password = await passwordHandler.encrypt(requestParam.password.toString());
            await query.updateSingle(dbConstants.dbSchema.riders, {password}, {rider_id: requestParam.rider_id});
            resolve({});
            return;
        } catch (error) {
            reject(error)
            return
        }
    })
};

// APIs

const signin = async(requestParam, req) => {
    return new Promise(async(resolve, reject) => {
        try {
            let response = await query.selectWithAndOne(dbConstants.dbSchema.riders, {mobile:requestParam.mobile}, { _id:0, rider_id:1, name:1, mobile:1, status:1, password:1} );
            if(!response){
                reject(errors(labels.LBL_MOBILE_FOUND[config.default_language], responseCodes.ResourceNotFound));
                return;
            }
            response = JSON.parse(JSON.stringify(response))
            let encryptPassword = await passwordHandler.encrypt(requestParam.password.toString());
            if(encryptPassword != response.password){
                reject(errors(labels.LBL_INVALID_PWD[config.default_language], responseCodes.InvalidOTP));
                return;
            }
            resolve(profile({rider_id: response.rider_id, time_zone: requestParam.time_zone}));
            return;
        } catch (error) {
            console.log(error)
            reject(error)
            return
        }
    })
};

const profile = async(requestParam) => {
    return new Promise(async(resolve, reject) => {
        try {
            let response = await query.selectWithAndOne(dbConstants.dbSchema.riders, {rider_id:requestParam.rider_id}, { _id:0, rider_id:1, name:1, mobile:1, status:1, total_balance:1} );
            if(!response){
                reject(errors(labels.LBL_USER_NOT_FOUND[config.default_language], responseCodes.ResourceNotFound));
                return;
            }
            response = JSON.parse(JSON.stringify(response))
            if(response.status == 'inactive'){
                reject(errors(labels.LBL_ACCOUNT_INACTIVE[config.default_language], responseCodes.NotActive));
                return;
            }
            response.my_balance = parseFloat(response.total_balance).toFixed(2)+' TZS'
            let activities = await query.selectWithAnd(dbConstants.dbSchema.rider_activities, {rider_id: requestParam.rider_id, type:'deduct', is_settlement:false}, { _id: 0}, { created_at: -1 });
            let admin_cost = 0
            await Promise.all(activities.map(async (elem) => {
                admin_cost += parseFloat(elem.admin_cost)
            }));
            response.pending_balance = parseFloat(admin_cost).toFixed(2)+' TZS'
            delete response.total_balance
            response.user_type = 'rider'
            resolve(await encryptDecryptHandler.encrypt(response));
            return;
        } catch (error) {
            console.log(error)
            reject(error)
            return
        }
    })
};

const transactionHistory = async(requestParam) => {
    return new Promise(async(resolve, reject) => {
        try {
            let page = (requestParam.page ? requestParam.page : 1);
            let limit = 10;
            page -= 1;
            let skip = page * limit;

            let response = await query.selectWithAndOne(dbConstants.dbSchema.riders, {rider_id:requestParam.rider_id}, { _id:0, rider_id:1} );
            if(!response){
                reject(errors(labels.LBL_USER_NOT_FOUND[config.default_language], responseCodes.ResourceNotFound));
                return;
            }
            let matchColumn = {rider_id: requestParam.rider_id}
            if(requestParam.date && requestParam.date != ''){
                matchColumn.created_at = {
                    $lte: new Date(requestParam.date+'T23:59:59.000Z'),
                    $gte: new Date(requestParam.date+'T00:00:00.000Z')
                }
            }
            let lists = await query.selectWithAndFilter(dbConstants.dbSchema.rider_activities, matchColumn, { _id:0, activity_id: 1, rider_id:1, amount:1, type:1, created_at:1}, { created_at: -1 }, { skip, limit });
            lists = JSON.parse(JSON.stringify(lists))
            await Promise.all(lists.map(async (elem) => {
                elem.created_at = timeZone(new Date(elem.created_at)).tz(requestParam.time_zone).format('lll')
            }))
            resolve(await encryptDecryptHandler.encrypt(lists));
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
    settlement,
    generateAccountNumber,
    getReport,
    getReportXlsx,
    changePassword,
    //APIs
    signin,
    profile,
    transactionHistory
};