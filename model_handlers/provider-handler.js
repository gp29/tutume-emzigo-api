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
const moment = require('moment');
const imgHandler = require('./../model_handlers/image-handler');
const FCM = require('fcm-push');
let fcm = new FCM(config.push_key);
const passwordHandler = require('./../utils/password-handler');
const encryptDecryptHandler = require('./../model_handlers/encrypt-decrypt-handler');

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

// FOR API

const signup = async(requestParam, req) => {
    return new Promise(async(resolve, reject) => {
        try {
            if(requestParam.name){
                requestParam.name = await encryptDecryptHandler.decryptString(requestParam.name)
            }
            if(requestParam.email){
                requestParam.email = await encryptDecryptHandler.decryptString(requestParam.email)
            }
            if(requestParam.password){
                requestParam.password = await encryptDecryptHandler.decryptString(requestParam.password)
            }
            if(requestParam.mobile_country_code){
                requestParam.mobile_country_code = await encryptDecryptHandler.decryptString(requestParam.mobile_country_code)
            }
            if(requestParam.mobile){
                requestParam.mobile = await encryptDecryptHandler.decryptString(requestParam.mobile)
            }
            if(requestParam.address){
                requestParam.address = await encryptDecryptHandler.decryptString(requestParam.address)
            }
            if(requestParam.vehicle_id){
                requestParam.vehicle_id = await encryptDecryptHandler.decryptString(requestParam.vehicle_id)
            }

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
            let res = await query.insertSingle(dbConstants.dbSchema.providers, requestParam);
            resolve(profile({provider_id: res.provider_id, time_zone: requestParam.time_zone}));
            return;
        } catch (error) {
            console.log(error)
            reject(error)
            return
        }
    })
};

const updateProfile = async(requestParam, req) => {
    return new Promise(async(resolve, reject) => {
        try {
            if(requestParam.email) delete requestParam.email
            if(requestParam.mobile) delete requestParam.mobile
            if(requestParam.mobile_country_code) delete requestParam.mobile_country_code

            if(requestParam.provider_id){
                requestParam.provider_id = await encryptDecryptHandler.decryptString(requestParam.provider_id)
            }
            if(requestParam.name){
                requestParam.name = await encryptDecryptHandler.decryptString(requestParam.name)
            }
            if(requestParam.address){
                requestParam.address = await encryptDecryptHandler.decryptString(requestParam.address)
            }
            if(requestParam.vehicle_id){
                requestParam.vehicle_id = await encryptDecryptHandler.decryptString(requestParam.vehicle_id)
            }

            let response = await query.selectWithAndOne(dbConstants.dbSchema.providers, {provider_id:requestParam.provider_id}, { _id:0, provider_id: 1, profile_photo:1, id_photo:1} );
            if(!response){
                reject(errors(labels.LBL_USER_NOT_FOUND[config.default_language], responseCodes.ResourceNotFound));
                return;
            }
            if(req.files){
                let objects = []
                if(req.files.profile_photo){
                    objects.push({
                        Key: `emzigo/providers/${response.profile_photo}`
                    })
                    requestParam.profile_photo = await imgHandler.uploadImage(req.files.profile_photo, config.aws.s3.providerBucket)
                }
                if(req.files.id_photo){
                    objects.push({
                        Key: `emzigo/providers/${response.id_photo}`
                    })
                    requestParam.id_photo = await imgHandler.uploadImage(req.files.id_photo, config.aws.s3.providerBucket)
                }
                if(objects.length > 0) await imgHandler.deleteImage(objects, config.aws.bucketName)
            }
            await query.updateSingle(dbConstants.dbSchema.providers, requestParam, {provider_id: requestParam.provider_id});
            resolve(profile({provider_id: requestParam.provider_id, time_zone: requestParam.time_zone}));
            return;
        } catch (error) {
            console.log(error)
            reject(error)
            return
        }
    })
};

const signin = async(requestParam, req) => {
    return new Promise(async(resolve, reject) => {
        try {
            let response = await query.selectWithAndOne(dbConstants.dbSchema.providers, {mobile_country_code:requestParam.mobile_country_code, mobile: requestParam.mobile}, { _id:0, provider_id: 1, password:1, name:1, email:1, status:1} );
            if(!response){
                reject(errors(labels.LBL_MOBILE_NOT_FOUND[config.default_language], responseCodes.ResourceNotFound));
                return;
            }
            response = JSON.parse(JSON.stringify(response))
            if(response.status == 'inactive'){
                reject(errors(labels.LBL_ACCOUNT_INACTIVE[config.default_language], responseCodes.NotActive));
                return;
            }
            let encryptPassword = await passwordHandler.encrypt(requestParam.password.toString());
            if(encryptPassword != response.password){
                reject(errors(labels.LBL_INVALID_PWD[config.default_language], responseCodes.InvalidOTP));
                return;
            }
            let updateColumn = {updated_at: new Date()}
            if(requestParam.device_token){
                updateColumn.device_token = requestParam.updateColumn
            }
            await query.updateSingle(dbConstants.dbSchema.providers, updateColumn, {provider_id: response.provider_id});
            resolve(profile({provider_id: response.provider_id, time_zone: requestParam.time_zone}));
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
            let response = await query.selectWithAndOne(dbConstants.dbSchema.providers, {provider_id:requestParam.provider_id}, { _id:0, provider_id: 1, name:1, email:1, mobile_country_code:1, mobile:1, profile_photo:1, id_photo:1, address:1, vehicle_id:1, status:1} );
            if(!response){
                reject(errors(labels.LBL_USER_NOT_FOUND[config.default_language], responseCodes.ResourceNotFound));
                return;
            }
            response = JSON.parse(JSON.stringify(response))
            if(response.status == 'inactive'){
                reject(errors(labels.LBL_ACCOUNT_INACTIVE[config.default_language], responseCodes.NotActive));
                return;
            }
            response.profile_photo = response.profile_photo != '' ? await imgHandler.getImage({bucket: config.aws.bucketName, key:`emzigo/providers/${response.profile_photo}`}) : ''
            response.id_photo = response.id_photo != '' ? await imgHandler.getImage({bucket: config.aws.bucketName, key:`emzigo/providers/${response.id_photo}`}) : ''
            resolve(await encryptDecryptHandler.encrypt(response));
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
            let response = await query.selectWithAndOne(dbConstants.dbSchema.providers, {mobile_country_code:requestParam.mobile_country_code, mobile: requestParam.mobile}, { _id:0, provider_id: 1} );
            if(!response){
                reject(errors(labels.LBL_MOBILE_NOT_FOUND[config.default_language], responseCodes.ResourceNotFound));
                return;
            }
            let password = await passwordHandler.encrypt(requestParam.password.toString());
            await query.updateSingle(dbConstants.dbSchema.providers, {password}, {provider_id: response.provider_id});
            resolve(await encryptDecryptHandler.encrypt({}));
            return;
        } catch (error) {
            reject(error)
            return
        }
    })
};

const logoutDelete = async(requestParam) => {
    return new Promise(async(resolve, reject) => {
        try {
            if(requestParam.type == 'logout'){
                await query.updateSingle(dbConstants.dbSchema.providers, {device_token:''}, { provider_id: requestParam.provider_id });
            }
            if(requestParam.type == 'delete'){
                let user = await query.selectWithAndOne(dbConstants.dbSchema.providers, {provider_id: requestParam.provider_id}, { _id:0, profile_photo: 1, id_photo:1});
                let objects = []
                if(user){
                    if(user.profile_photo != ''){
                        objects.push({
                            Key: `emzigo/providers/${user.profile_photo}`
                        })
                    }
                    if(user.id_photo != ''){
                        objects.push({
                            Key: `emzigo/providers/${user.id_photo}`
                        })
                    }
                    if(objects.length > 0){
                        await imgHandler.deleteImage(objects, config.aws.bucketName)
                    }
                }
                await query.removeMultiple(dbConstants.dbSchema.providers, {provider_id: requestParam.provider_id})
            }
            resolve(await encryptDecryptHandler.encrypt({}))
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
    sendNotification,

    // FOR API
    signup,
    signin,
    updateProfile,
    profile,
    changePassword,
    logoutDelete,
};