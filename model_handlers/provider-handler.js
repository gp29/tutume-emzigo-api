'use strict';

const config = require('./../config');
const errors = require('./../utils/dz-errors');
const dbConstants = require('./../constants/db-constants');
const query = require('./../utils/query-creator');
const provider = require('./../models/provider');
const _ = require('underscore');
const labels = require('./../utils/labels.json');
const responseCodes = require('./../utils/response-codes');
const timeZone = require('moment-timezone');
const imgHandler = require('./../model_handlers/image-handler');
const FCM = require('fcm-push');
let fcm = new FCM(config.push_key);
const passwordHandler = require('./../utils/password-handler');

const get = async(requestParam) => {
    return new Promise(async(resolve, reject) => {
        try {
            let columnValue = {}
            if(requestParam.provider_id){
                columnValue.provider_id = requestParam.provider_id
            }
            if(requestParam.status){
                columnValue.status = requestParam.status
            }
            let response = await query.selectWithAnd(dbConstants.dbSchema.providers, columnValue, { _id: 0}, { created_at: 1 });
            if(requestParam.provider_id){
                response = response[0]
                response.profile_photo = response.profile_photo != '' ? await imgHandler.getImage({bucket: config.aws.bucketName, key:`emzigo/providers/${response.profile_photo}`}) : ''
                response.id_photo = response.id_photo != '' ? await imgHandler.getImage({bucket: config.aws.bucketName, key:`emzigo/providers/${response.id_photo}`}) : ''
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

const getSort = async(requestParam) => {
    return new Promise(async(resolve, reject) => {
        try {
            let columnAndValue = {}
            if(requestParam.text && requestParam.text !=''){
                columnAndValue['$or'] = [{
                    provider_id: new RegExp(requestParam.text, 'i')
                }, {
                    name: new RegExp(requestParam.text, 'i')
                }, {
                    email: new RegExp(requestParam.text, 'i')
                }, {
                    mobile_country_code: new RegExp(requestParam.text, 'i')
                }, {
                    mobile: new RegExp(requestParam.text, 'i')
                }, {
                    status: new RegExp(requestParam.text, 'i')
                }];
            }
            let page = requestParam.page ? requestParam.page : 0 ;
            let sizePerPage = requestParam.sizePerPage ? requestParam.sizePerPage : 10 ;
            let skip = page * sizePerPage;
            let obj = {};

            let count = await query.countRecord(dbConstants.dbSchema.providers, columnAndValue)
            let joinArr = [{ 
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
                    provider_id:1,
                    name:1,
                    email:1,
                    mobile:{ $concat: [ "$mobile_country_code", " ", "$mobile" ] },
                    status:1,
                    created_at:1,
                    jobs:"0",
                }
            }];
            let data = await query.joinWithAnd(dbConstants.dbSchema.providers, joinArr);
            data = JSON.parse(JSON.stringify(data))
            _.each(data, (elem) => {
                elem.created_at = timeZone(new Date(elem.created_at)).tz(requestParam.time_zone).format('lll')
            })
            obj.data = data;
            obj.count = count;
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
            requestParam.email = requestParam.email.trim();
            let regexEmail = new RegExp(['^', requestParam.email, '$'].join(''), 'i');
            let compareColumnAndValues = {
                 $or: [{
                    email: regexEmail
                }, {
                    mobile: requestParam.mobile,
                    mobile_country_code: requestParam.mobile_country_code,
                }]
            };
            let response = await query.selectWithAndOne(dbConstants.dbSchema.providers, compareColumnAndValues, { _id: 0, provider_id:1}, { created_at: 1 });
            if(response){
                reject(errors(labels.LBL_EMAIL_OR_MOBILE_ALREADY_EXISTS[config.default_language], responseCodes.ResourceNotFound));
                return;
            }
            if(req.files){
                if(req.files.profile_photo){
                    requestParam.profile_photo = await imgHandler.uploadImage(req.files.profile_photo, config.aws.s3.providerBucket)
                }
                if(req.files.id_photo){
                    requestParam.id_photo = await imgHandler.uploadImage(req.files.id_photo, config.aws.s3.providerBucket)
                }
            }
            requestParam.password = await passwordHandler.encrypt(requestParam.password.toString())
            await query.insertSingle(dbConstants.dbSchema.providers, requestParam);
            resolve({});
            return;
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
            requestParam.email = requestParam.email.trim();
            let regexEmail = new RegExp(['^', requestParam.email, '$'].join(''), 'i');
            let compareColumnAndValues = {
                $and: [{
                    $or: [{
                        email: regexEmail
                    }, {
                        mobile: requestParam.mobile,
                        mobile_country_code: requestParam.mobile_country_code,
                    }]
                }, {
                    provider_id: {
                        $ne: requestParam.provider_id
                    }
                }]
            };
            let response = await query.selectWithAndOne(dbConstants.dbSchema.providers, compareColumnAndValues, { _id: 0, provider_id:1}, { created_at: 1 });
            if(response){
                reject(errors(labels.LBL_EMAIL_OR_MOBILE_ALREADY_EXISTS[config.default_language], responseCodes.ResourceNotFound));
                return;
            }
            let customer = await query.selectWithAndOne(dbConstants.dbSchema.providers, {provider_id: requestParam.provider_id}, { _id: 0, profile_photo:1, id_photo:1}, { created_at: 1 });
            if (requestParam.change_logo) {
                const objects = [{
                    Key: `emzigo/providers/${customer.profile_photo}`
                }];
                await imgHandler.deleteImage(objects, config.aws.bucketName)
                requestParam.profile_photo = await imgHandler.uploadImage(req.files.profile_photo, config.aws.s3.providerBucket)
            }
            else{
                delete requestParam.profile_photo
            }

            if (requestParam.change_id_photo) {
                const objects = [{
                    Key: `emzigo/providers/${customer.id_photo}`
                }];
                await imgHandler.deleteImage(objects, config.aws.bucketName)
                requestParam.id_photo = await imgHandler.uploadImage(req.files.id_photo, config.aws.s3.providerBucket)
            }
            else{
                delete requestParam.id_photo
            }
            await query.updateSingle(dbConstants.dbSchema.providers, requestParam, {provider_id: requestParam.provider_id});
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
                let response = await query.selectWithAnd(dbConstants.dbSchema.providers, {provider_id: {$in: requestParam.ids}}, { _id: 0, provider_id:1, profile_photo:1, id_photo:1}, { created_at: 1 });
                let objects = []
                await Promise.all(response.map(async (elem) => {
                    objects.push({
                        Key: `emzigo/providers/${elem.profile_photo}`
                    });
                    objects.push({
                        Key: `emzigo/providers/${elem.id_photo}`
                    });
                }))
                if(objects.length > 0) await imgHandler.deleteImage(objects, config.aws.bucketName)
                await query.removeMultiple(dbConstants.dbSchema.providers, { provider_id: { $in: requestParam['ids']}});
            }
            else{
                await query.updateMultiple(dbConstants.dbSchema.providers, {status: requestParam.type}, {provider_id: { $in: requestParam['ids']}});
            }
            resolve({});
            return;
        } catch (error) {
            reject(error)
            return
        }
    })
};

const sendNotification = async(requestParam) => {
    return new Promise(async(resolve, reject) => {
        try {
            let providers = await query.selectWithAnd(dbConstants.dbSchema.providers, {
                provider_id: {
                    $in: requestParam.ids
                }
            }, {
                _id: 0,
                provider_id: 1,
                device_token: 1
            }, {
                created_at: 1
            });
            sendNotiProvider(providers, requestParam.title)
            resolve({});
            return;
        } catch (error) {
            reject(error)
            return
        }
    })
};

const sendNotiProvider = async(providers, title) => {
    return new Promise(async(resolve, reject) => {
        try {
            await Promise.all(providers.map(async(element) => {
                let message = {
                    to: element.device_token,
                    collapse_key: 'your_collapse_key',
                    content_available: true,
                    mutable_content: true,
                    priority: "high",
                    data: {
                        type: 'promotion',
                        title: 'Promotion',
                    },
                    notification: {
                        title: 'Promotion',
                        body: title,
                        sound: 'default'
                    }
                };
                fcm.send(message, function(err, response) {
                    return false;
                });
            }))
            return false;
        } catch (error) {
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
    sendNotification,
};