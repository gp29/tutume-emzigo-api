'use strict';

const config = require('./../config');
const errors = require('./../utils/dz-errors');
const dbConstants = require('./../constants/db-constants');
const query = require('./../utils/query-creator');
const customer = require('./../models/customer');
const job = require('./../models/job');
const _ = require('underscore');
const labels = require('./../utils/labels.json');
const responseCodes = require('./../utils/response-codes');
const timeZone = require('moment-timezone');
const imgHandler = require('./../model_handlers/image-handler');
const distance = require('google-distance');
distance.apiKey = config.google_key;
const encryptDecryptHandler = require('./../model_handlers/encrypt-decrypt-handler');
const passwordHandler = require('./../utils/password-handler');

const get = async(requestParam) => {
    return new Promise(async(resolve, reject) => {
        try {
            let columnValue = {}
            if(requestParam.customer_id){
                columnValue.customer_id = requestParam.customer_id
            }
            if(requestParam.status){
                columnValue.status = requestParam.status
            }
            let response = await query.selectWithAnd(dbConstants.dbSchema.customers, columnValue, { _id: 0}, { created_at: 1 });
            if(requestParam.customer_id){
                response = response[0]
                response.profile_photo = response.profile_photo != '' ? await imgHandler.getImage({bucket: config.aws.bucketName, key:`emzigo/customers/${response.profile_photo}`}) : ''
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
                    customer_id: new RegExp(requestParam.text, 'i')
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

            let count = await query.countRecord(dbConstants.dbSchema.customers, columnAndValue)
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
                    customer_id:1,
                    name:1,
                    email:1,
                    mobile:{ $concat: [ "$mobile_country_code", " ", "$mobile" ] },
                    status:1,
                    created_at:1,
                    jobs:"0",
                }
            }];
            let data = await query.joinWithAnd(dbConstants.dbSchema.customers, joinArr);
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
            let response = await query.selectWithAndOne(dbConstants.dbSchema.customers, compareColumnAndValues, { _id: 0, customer_id:1}, { created_at: 1 });
            if(response){
                reject(errors(labels.LBL_EMAIL_OR_MOBILE_ALREADY_EXISTS[config.default_language], responseCodes.ResourceNotFound));
                return;
            }
            if(req.files){
                if(req.files.profile_photo){
                    requestParam.profile_photo = await imgHandler.uploadImage(req.files.profile_photo, config.aws.s3.customerBucket)
                }
            }
            await query.insertSingle(dbConstants.dbSchema.customers, requestParam);
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
                    customer_id: {
                        $ne: requestParam.customer_id
                    }
                }]
            };
            let response = await query.selectWithAndOne(dbConstants.dbSchema.customers, compareColumnAndValues, { _id: 0, customer_id:1}, { created_at: 1 });
            if(response){
                reject(errors(labels.LBL_EMAIL_OR_MOBILE_ALREADY_EXISTS[config.default_language], responseCodes.ResourceNotFound));
                return;
            }
            let customer = await query.selectWithAndOne(dbConstants.dbSchema.customers, {customer_id: requestParam.customer_id}, { _id: 0, profile_photo:1}, { created_at: 1 });
            if (requestParam.change_logo) {
                const objects = [{
                    Key: `emzigo/customers/${customer.profile_photo}`
                }];
                await imgHandler.deleteImage(objects, config.aws.bucketName)
                requestParam.profile_photo = await imgHandler.uploadImage(req.files.profile_photo, config.aws.s3.customerBucket)
            }
            else{
                delete requestParam.profile_photo
            }
            await query.updateSingle(dbConstants.dbSchema.customers, requestParam, {customer_id: requestParam.customer_id});
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
                let response = await query.selectWithAnd(dbConstants.dbSchema.customers, {customer_id: {$in: requestParam.ids}}, { _id: 0, customer_id:1, profile_photo:1}, { created_at: 1 });
                let objects = []
                await Promise.all(response.map(async (elem) => {
                    objects.push({
                        Key: `emzigo/customers/${elem.profile_photo}`
                    });
                }))
                if(objects.length > 0) await imgHandler.deleteImage(objects, config.aws.bucketName)
                await query.removeMultiple(dbConstants.dbSchema.customers, { customer_id: { $in: requestParam['ids']}});
            }
            else{
                await query.updateMultiple(dbConstants.dbSchema.customers, {status: requestParam.type}, {customer_id: { $in: requestParam['ids']}});
            }
            resolve({});
            return;
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
            let response = await query.selectWithAndOne(dbConstants.dbSchema.customers, compareColumnAndValues, { _id: 0, customer_id:1}, { created_at: 1 });
            if(response){
                reject(errors(labels.LBL_EMAIL_OR_MOBILE_ALREADY_EXISTS[config.default_language], responseCodes.ResourceNotFound));
                return;
            }
            if(req.files){
                if(req.files.profile_photo){
                    requestParam.profile_photo = await imgHandler.uploadImage(req.files.profile_photo, config.aws.s3.customerBucket)
                }
            }
            requestParam.password = await passwordHandler.encrypt(requestParam.password.toString())
            await query.insertSingle(dbConstants.dbSchema.customers, requestParam);
            resolve(await encryptDecryptHandler.encrypt({}));
            return;
        } catch (error) {
            console.log(error)
            reject(error)
            return
        }
    })
};

const checkPrice = async(requestParam) => {
    return new Promise(async(resolve, reject) => {
        try {
            let response = await query.selectWithAndOne(dbConstants.dbSchema.customers, {customer_id:requestParam.customer_id}, { _id:0, customer_id: 1} );
            if(!response){
                reject(errors(labels.LBL_USER_NOT_FOUND[config.default_language], responseCodes.ResourceNotFound));
                return;
            }
            let vehicle = await query.selectWithAndOne(dbConstants.dbSchema.vehicles, {vehicle_id:requestParam.vehicle_id}, { _id:0, vehicle_id: 1} );
            if(!vehicle){
                reject(errors(labels.LBL_VEHICLE_NOT_FOUND[config.default_language], responseCodes.ResourceNotFound));
                return;
            }
            let delivery_option = await query.selectWithAndOne(dbConstants.dbSchema.delivery_options, {delivery_option_id:requestParam.delivery_option_id}, { _id:0, customer_id: 1} );
            if(!delivery_option){
                reject(errors(labels.LBL_DELIVERY_OPTION_NOT_FOUND[config.default_language], responseCodes.ResourceNotFound));
                return;
            }
            let vehicle_price = await query.selectWithAndOne(dbConstants.dbSchema.vehicle_prices, {vehicle_id:requestParam.vehicle_id, delivery_option_id:requestParam.delivery_option_id}, { _id:0} );
            if(vehicle_price){
                distance.get({
                    origin: requestParam.pickup_address,
                    destination: requestParam.delivery_address
                },
                async function (err, data) {
                    if(!data || err){
                        reject(errors(labels.LBL_DISTANCE_NOT_FOUND[config.default_language], responseCodes.ResourceNotFound));
                        return;
                    }
                    let kms = (data.distanceValue/1000);
                    let delivery_price = parseFloat(vehicle_price.base_fare) + (kms*parseFloat(vehicle_price.per_km_fare))
                    let obj = {
                        total:parseFloat(delivery_price.toFixed(2)),
                        total_distance : data.distanceValue,
                        formatted_distance: data.distance,
                        total_duration: data.durationValue,
                        formatted_duration: data.duration,
                    }
                    resolve(await encryptDecryptHandler.encrypt(obj));
                    return;
                });
            }
            else{
                let obj = {
                    total:0,
                    total_distance : 0,
                    formatted_distance: 0,
                    total_duration: 0,
                    formatted_duration: 0,
                }
                resolve(await encryptDecryptHandler.encrypt(obj));
                return;
            }
        } catch (error) {
            reject(error)
            return
        }
    })
};

const createJob = async(requestParam) => {
    return new Promise(async(resolve, reject) => {
        try {
            let response = await query.selectWithAndOne(dbConstants.dbSchema.customers, {customer_id:requestParam.customer_id}, { _id:0, customer_id: 1} );
            if(!response){
                reject(errors(labels.LBL_USER_NOT_FOUND[config.default_language], responseCodes.ResourceNotFound));
                return;
            }
            let vehicle = await query.selectWithAndOne(dbConstants.dbSchema.vehicles, {vehicle_id:requestParam.vehicle_id}, { _id:0, vehicle_id: 1} );
            if(!vehicle){
                reject(errors(labels.LBL_VEHICLE_NOT_FOUND[config.default_language], responseCodes.ResourceNotFound));
                return;
            }
            let delivery_option = await query.selectWithAndOne(dbConstants.dbSchema.delivery_options, {delivery_option_id:requestParam.delivery_option_id}, { _id:0, customer_id: 1} );
            if(!delivery_option){
                reject(errors(labels.LBL_DELIVERY_OPTION_NOT_FOUND[config.default_language], responseCodes.ResourceNotFound));
                return;
            }
            if(requestParam.coupon_id && requestParam.coupon_id !== ''){
                let coupon = await query.selectWithAndOne(dbConstants.dbSchema.coupons, {coupon_id:requestParam.coupon_id}, { _id:0, coupon_id: 1, total_used:1} );
                if(coupon){
                    await query.updateSingle(dbConstants.dbSchema.coupons, {$inc:{total_used: 1}}, {coupon_id: requestParam.coupon_id});
                }
            }
            await query.insertSingle(dbConstants.dbSchema.jobs, requestParam);
            resolve(await encryptDecryptHandler.encrypt({}));
            return;
        } catch (error) {
            reject(error)
            return
        }
    })
};

const updateJob = async(requestParam) => {
    return new Promise(async(resolve, reject) => {
        try {
            let response = await query.selectWithAndOne(dbConstants.dbSchema.customers, {customer_id:requestParam.customer_id}, { _id:0, customer_id: 1} );
            if(!response){
                reject(errors(labels.LBL_USER_NOT_FOUND[config.default_language], responseCodes.ResourceNotFound));
                return;
            }
            let job = await query.selectWithAndOne(dbConstants.dbSchema.jobs, {job_id:requestParam.job_id}, { _id:0, job_id: 1} );
            if(!job){
                reject(errors(labels.LBL_JOB_NOT_FOUND[config.default_language], responseCodes.ResourceNotFound));
                return;
            }
            let vehicle = await query.selectWithAndOne(dbConstants.dbSchema.vehicles, {vehicle_id:requestParam.vehicle_id}, { _id:0, vehicle_id: 1} );
            if(!vehicle){
                reject(errors(labels.LBL_VEHICLE_NOT_FOUND[config.default_language], responseCodes.ResourceNotFound));
                return;
            }
            let delivery_option = await query.selectWithAndOne(dbConstants.dbSchema.delivery_options, {delivery_option_id:requestParam.delivery_option_id}, { _id:0, customer_id: 1} );
            if(!delivery_option){
                reject(errors(labels.LBL_DELIVERY_OPTION_NOT_FOUND[config.default_language], responseCodes.ResourceNotFound));
                return;
            }
            await query.updateSingle(dbConstants.dbSchema.jobs, requestParam, {job_id: requestParam.job_id});
            resolve(await encryptDecryptHandler.encrypt({}));
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

    // FOR API
    signup,
    checkPrice,
    createJob,
    updateJob,
};