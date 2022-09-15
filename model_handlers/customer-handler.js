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
const moment = require('moment');
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
            requestParam.password = await passwordHandler.encrypt(requestParam.password.toString())
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

const register = async(requestParam, req) => {
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
            let response = await query.selectWithAndOne(dbConstants.dbSchema.customers, compareColumnAndValues, { _id: 0, customer_id:1, name:1}, { created_at: 1 });
            if(response){
                resolve({name: response.name, customer_id: response.customer_id});
                return;
            }
            requestParam.password = await passwordHandler.encrypt(requestParam.password.toString())
            let res = await query.insertSingle(dbConstants.dbSchema.customers, requestParam);
            resolve({name: res.name, customer_id: res.customer_id});
            return;
        } catch (error) {
            console.log(error)
            reject(error)
            return
        }
    })
};

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
            let res = await query.insertSingle(dbConstants.dbSchema.customers, requestParam);
            resolve(profile({customer_id: res.customer_id, time_zone: requestParam.time_zone}));
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

            if(requestParam.customer_id){
                requestParam.customer_id = await encryptDecryptHandler.decryptString(requestParam.customer_id)
            }
            if(requestParam.name){
                requestParam.name = await encryptDecryptHandler.decryptString(requestParam.name)
            }
            let response = await query.selectWithAndOne(dbConstants.dbSchema.customers, {customer_id:requestParam.customer_id}, { _id:0, customer_id: 1, profile_photo:1} );
            if(!response){
                reject(errors(labels.LBL_USER_NOT_FOUND[config.default_language], responseCodes.ResourceNotFound));
                return;
            }
            if(req.files && req.files.profile_photo){
                const objects = [{
                    Key: `emzigo/customers/${response.profile_photo}`
                }];
                await imgHandler.deleteImage(objects, config.aws.bucketName)
                requestParam.profile_photo = await imgHandler.uploadImage(req.files.profile_photo, config.aws.s3.customerBucket)
            }
            await query.updateSingle(dbConstants.dbSchema.customers, requestParam, {customer_id: requestParam.customer_id});
            resolve(profile({customer_id: requestParam.customer_id, time_zone: requestParam.time_zone}));
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
            let response = await query.selectWithAndOne(dbConstants.dbSchema.customers, {mobile_country_code:requestParam.mobile_country_code, mobile: requestParam.mobile}, { _id:0, customer_id: 1, password:1, name:1, email:1, status:1} );
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
                updateColumn.device_token = requestParam.device_token
            }
            await query.updateSingle(dbConstants.dbSchema.customers, updateColumn, {customer_id: response.customer_id});
            resolve(profile({customer_id: response.customer_id, time_zone: requestParam.time_zone}));
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
            let response = await query.selectWithAndOne(dbConstants.dbSchema.customers, {customer_id:requestParam.customer_id}, { _id:0, customer_id: 1, name:1, email:1, mobile_country_code:1, mobile:1, profile_photo:1, status:1} );
            if(!response){
                reject(errors(labels.LBL_USER_NOT_FOUND[config.default_language], responseCodes.ResourceNotFound));
                return;
            }
            response = JSON.parse(JSON.stringify(response))
            if(response.status == 'inactive'){
                reject(errors(labels.LBL_ACCOUNT_INACTIVE[config.default_language], responseCodes.NotActive));
                return;
            }
            response.profile_photo = response.profile_photo != '' ? await imgHandler.getImage({bucket: config.aws.bucketName, key:`emzigo/customers/${response.profile_photo}`}) : ''
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
            let response = await query.selectWithAndOne(dbConstants.dbSchema.customers, {mobile_country_code:requestParam.mobile_country_code, mobile: requestParam.mobile}, { _id:0, customer_id: 1} );
            if(!response){
                reject(errors(labels.LBL_MOBILE_NOT_FOUND[config.default_language], responseCodes.ResourceNotFound));
                return;
            }
            let password = await passwordHandler.encrypt(requestParam.password.toString());
            await query.updateSingle(dbConstants.dbSchema.customers, {password}, {customer_id: response.customer_id});
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
                await query.updateSingle(dbConstants.dbSchema.customers, {device_token:''}, { customer_id: requestParam.customer_id });
            }
            if(requestParam.type == 'delete'){
                let user = await query.selectWithAndOne(dbConstants.dbSchema.customers, {customer_id: requestParam.customer_id}, { _id:0, profile_photo: 1});
                let objects = []
                if(user){
                    if(user.profile_photo != ''){
                        objects.push({
                            Key: `emzigo/customers/${user.profile_photo}`
                        })
                    }
                    if(objects.length > 0){
                        await imgHandler.deleteImage(objects, config.aws.bucketName)
                    }
                }
                await query.removeMultiple(dbConstants.dbSchema.customers, {customer_id: requestParam.customer_id})
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
            if(requestParam.amount_pay){
                requestParam.amount_pay = parseFloat(parseFloat(requestParam.amount_pay).toFixed(2))
            }
            if(!requestParam.transaction_id){
                requestParam.transaction_id = 'TRA'+moment().unix()
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


const createOrder = async(requestParam) => {
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
            if(requestParam.amount_pay){
                requestParam.amount_pay = parseFloat(parseFloat(requestParam.amount_pay).toFixed(2))
            }
            if(!requestParam.transaction_id){
                requestParam.transaction_id = 'TRA'+moment().unix()
            }
            let ord = await query.insertSingle(dbConstants.dbSchema.jobs, requestParam);
            resolve({job_id: ord.job_id});
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
            if(requestParam.coupon_id && requestParam.coupon_id !== ''){
                let coupon = await query.selectWithAndOne(dbConstants.dbSchema.coupons, {coupon_id:requestParam.coupon_id}, { _id:0, coupon_id: 1, total_used:1} );
                if(coupon){
                    await query.updateSingle(dbConstants.dbSchema.coupons, {$inc:{total_used: 1}}, {coupon_id: requestParam.coupon_id});
                }
            }
            if(requestParam.amount_pay){
                requestParam.amount_pay = parseFloat(parseFloat(requestParam.amount_pay).toFixed(2))
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

const uploadItemImgae = async(req) => {
    return new Promise(async(resolve, reject) => {
        try {
            let item_image;
            if(req.files){
                if(req.files.item_image){
                    item_image = await imgHandler.uploadImage(req.files.item_image, config.aws.s3.customerBucket)
                }
            }
            resolve(await encryptDecryptHandler.encrypt({item_image}));
            return;
        } catch (error) {
            console.log(error)
            reject(error)
            return
        }
    })
};

const applyCoupon = async(requestParam) => {
    return new Promise(async(resolve, reject) => {
        try {
            let response = await query.selectWithAndOne(dbConstants.dbSchema.customers, {customer_id:requestParam.customer_id}, { _id:0, customer_id: 1} );
            if(!response){
                reject(errors(labels.LBL_USER_NOT_FOUND[config.default_language], responseCodes.ResourceNotFound));
                return;
            }
            let coupon = await query.selectWithAndOne(dbConstants.dbSchema.coupons, { coupon_code: requestParam.coupon_code, status:'active'}, {_id:0, created_at:0, updated_at:0, __v:0});
            if(!coupon){
                reject(errors(labels.LBL_COUPON_NOT_FOUND[config.default_language], responseCodes.ResourceNotFound));
                return;
            }
            let todayDate = timeZone(new Date()).tz(requestParam.time_zone).format('YYYY-MM-DD');
            if(moment(todayDate).isBetween(coupon.start_date, coupon.end_date, null, '[]')){
                if(coupon.total_used >= coupon.total_usage){
                    reject(errors(labels.LBL_COUPON_EXPIRED[config.default_language], responseCodes.ResourceNotFound));
                    return;
                }
                else{
                    resolve(await encryptDecryptHandler.encrypt(coupon));
                    return;
                }
            }
            else{
                reject(errors(labels.LBL_COUPON_EXPIRED[config.default_language], responseCodes.ResourceNotFound));
                return;
            }
        } catch (error) {
            console.log(error)
            reject(error)
            return
        }
    })
};

const getCurrentDelivery = async(requestParam) => {
    return new Promise(async(resolve, reject) => {
        try {
            let response = await query.selectWithAndOne(dbConstants.dbSchema.customers, {customer_id:requestParam.customer_id}, { _id:0, customer_id: 1} );
            if(!response){
                reject(errors(labels.LBL_USER_NOT_FOUND[config.default_language], responseCodes.ResourceNotFound));
                return;
            }
            let joinArr = [{
                $lookup: {
                    from: 'vehicles',
                    localField: 'vehicle_id',
                    foreignField: 'vehicle_id',
                    as: 'vehicleDetails',
                },
            }, {
                $unwind: "$vehicleDetails"
            }, {
                $lookup: {
                    from: 'delivery_options',
                    localField: 'delivery_option_id',
                    foreignField: 'delivery_option_id',
                    as: 'delOptionDetails',
                },
            }, {
                $unwind: "$delOptionDetails"
            }, { 
                $match : {customer_id: requestParam.customer_id, status:{$nin: ['cancelled', 'delivered']}}
            }, { 
                $sort : {created_at:-1}
            }, {
                $project: {
                    _id: 0,
                    customer_id: 1,
                    job_id: 1,
                    vehicle_id: 1,
                    delivery_option_id: 1,
                    pickup_from: 1,
                    pickup_landmark: 1,
                    pickup_address: 1,
                    pickup_latitude: 1,
                    pickup_longitude: 1,
                    delivery_landmark: 1,
                    delivery_address: 1,
                    delivery_latitude: 1,
                    delivery_longitude: 1,
                    pickup_contact_name: 1,
                    pickup_contact_number: 1,
                    pickup_instructions: 1,
                    delivery_contact_name: 1,
                    delivery_contact_number: 1,
                    delivery_instructions: 1,
                    item_name: 1,
                    weight: 1,
                    item_desc: 1,
                    item_authority: 1,
                    accepted_at: 1,
                    pickedup_at: 1,
                    delivered_at: 1,
                    status: 1,
                    item_image: 1,
                    total: 1,
                    discount: 1,
                    amount_pay: 1,
                    vehicle_name:"$vehicleDetails.name",
                    delivery_option_name:"$delOptionDetails.name",
                    delivery_option_code:"$delOptionDetails.code",
                }
            }];
            let lists = await query.joinWithAnd(dbConstants.dbSchema.jobs, joinArr);
            lists = JSON.parse(JSON.stringify(lists))
            await Promise.all(lists.map(async (elem) => {
                elem.deliver_date = ''
                elem.deliver_time = ''
                let dt;
                if(elem.delivery_option_code == '2H'){
                    dt = timeZone(new Date(elem.pickup_from)).tz(requestParam.time_zone).add(2, 'hours');
                }
                if(elem.delivery_option_code == '4H'){
                    dt = timeZone(new Date(elem.pickup_from)).tz(requestParam.time_zone).add(4, 'hours');
                }
                if(elem.delivery_option_code == 'SAME_DAY'){
                    dt = timeZone(new Date(elem.pickup_from)).tz(requestParam.time_zone);
                }
                elem.deliver_date = timeZone(new Date(dt)).tz(requestParam.time_zone).format('YYYY-MM-DD')
                elem.deliver_time = timeZone(new Date(dt)).tz(requestParam.time_zone).format('LT')

                elem.pickup_from = timeZone(new Date(elem.pickup_from)).tz(requestParam.time_zone).format('DD MMM yyyy h:mm a')
                elem.pickedup_at = elem.pickedup_at ? timeZone(new Date(elem.pickedup_at)).tz(requestParam.time_zone).format('lll') : ''
                elem.accepted_at = elem.accepted_at ? timeZone(new Date(elem.accepted_at)).tz(requestParam.time_zone).format('lll') : ''

                elem.item_image = elem.item_image != '' ? await imgHandler.getImage({bucket: config.aws.bucketName, key:`emzigo/customers/${elem.item_image}`}) : ''

                delete elem.delivery_option_code
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

const deliveryHistory = async(requestParam) => {
    return new Promise(async(resolve, reject) => {
        try {
            let response = await query.selectWithAndOne(dbConstants.dbSchema.customers, {customer_id:requestParam.customer_id}, { _id:0, customer_id: 1} );
            if(!response){
                reject(errors(labels.LBL_USER_NOT_FOUND[config.default_language], responseCodes.ResourceNotFound));
                return;
            }
            let joinArr = [{
                $lookup: {
                    from: 'vehicles',
                    localField: 'vehicle_id',
                    foreignField: 'vehicle_id',
                    as: 'vehicleDetails',
                },
            }, {
                $unwind: "$vehicleDetails"
            }, {
                $lookup: {
                    from: 'delivery_options',
                    localField: 'delivery_option_id',
                    foreignField: 'delivery_option_id',
                    as: 'delOptionDetails',
                },
            }, {
                $unwind: "$delOptionDetails"
            }, { 
                $match : {customer_id: requestParam.customer_id, status:{$in: ['cancelled', 'delivered']}}
            }, { 
                $sort : {created_at:-1}
            }, {
                $project: {
                    _id: 0,
                    customer_id: 1,
                    job_id: 1,
                    vehicle_id: 1,
                    delivery_option_id: 1,
                    pickup_from: 1,
                    pickup_landmark: 1,
                    pickup_address: 1,
                    pickup_latitude: 1,
                    pickup_longitude: 1,
                    delivery_landmark: 1,
                    delivery_address: 1,
                    delivery_latitude: 1,
                    delivery_longitude: 1,
                    pickup_contact_name: 1,
                    pickup_contact_number: 1,
                    pickup_instructions: 1,
                    delivery_contact_name: 1,
                    delivery_contact_number: 1,
                    delivery_instructions: 1,
                    item_name: 1,
                    weight: 1,
                    item_desc: 1,
                    item_authority: 1,
                    accepted_at: 1,
                    pickedup_at: 1,
                    delivered_at: 1,
                    status: 1,
                    item_image: 1,
                    total: 1,
                    discount: 1,
                    amount_pay: 1,
                    vehicle_name:"$vehicleDetails.name",
                    delivery_option_name:"$delOptionDetails.name",
                }
            }];
            let lists = await query.joinWithAnd(dbConstants.dbSchema.jobs, joinArr);
            lists = JSON.parse(JSON.stringify(lists))
            await Promise.all(lists.map(async (elem) => {
                if(elem.status == 'cancelled'){
                    elem.delivered_at = elem.pickup_from
                }
                elem.deliver_date = timeZone(new Date(elem.delivered_at)).tz(requestParam.time_zone).format('YYYY-MM-DD')
                elem.deliver_time = timeZone(new Date(elem.delivered_at)).tz(requestParam.time_zone).format('LT')

                elem.pickedup_at = elem.pickedup_at ? timeZone(new Date(elem.pickedup_at)).tz(requestParam.time_zone).format('lll') : ''
                elem.pickup_from = timeZone(new Date(elem.pickup_from)).tz(requestParam.time_zone).format('DD MMM yyyy h:mm a')

                elem.item_image = elem.item_image != '' ? await imgHandler.getImage({bucket: config.aws.bucketName, key:`emzigo/customers/${elem.item_image}`}) : ''
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

const recentlyShipped = async(requestParam) => {
    return new Promise(async(resolve, reject) => {
        try {
            let skip = 0
            let limit = 5
            let response = await query.selectWithAndOne(dbConstants.dbSchema.customers, {customer_id:requestParam.customer_id}, { _id:0, customer_id: 1} );
            if(!response){
                reject(errors(labels.LBL_USER_NOT_FOUND[config.default_language], responseCodes.ResourceNotFound));
                return;
            }
            let joinArr = [{
                $lookup: {
                    from: 'providers',
                    localField: 'provider_id',
                    foreignField: 'provider_id',
                    as: 'proDetails',
                },
            }, {
                $unwind: "$proDetails"
            }, { 
                $match : {customer_id: requestParam.customer_id, status:'delivered'}
            }, { 
                $sort : {created_at: -1}
            }, {
                $skip: skip
            }, {
                $limit: limit
            }, {
                $project: {
                    _id: 0,
                    job_id: 1,
                    item_name: 1,
                    weight: 1,
                    item_desc: 1,
                    delivered_at: 1,
                    provider_name: "$proDetails.name",
                    provider_photo: "$proDetails.profile_photo",
                }
            }];
            let lists = await query.joinWithAnd(dbConstants.dbSchema.jobs, joinArr);
            lists = JSON.parse(JSON.stringify(lists))
            await Promise.all(lists.map(async (elem) => {
                elem.deliver_date = timeZone(new Date(elem.delivered_at)).tz(requestParam.time_zone).format('YYYY-MM-DD')
                elem.deliver_time = timeZone(new Date(elem.delivered_at)).tz(requestParam.time_zone).format('LT')
                elem.provider_photo = elem.provider_photo != '' ? await imgHandler.getImage({bucket: config.aws.bucketName, key:`emzigo/providers/${elem.provider_photo}`}) : ''
                delete elem.delivered_at
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

const cancelJob = async(requestParam) => {
    return new Promise(async(resolve, reject) => {
        try {
            let response = await query.selectWithAndOne(dbConstants.dbSchema.customers, {customer_id:requestParam.customer_id}, { _id:0, customer_id: 1} );
            if(!response){
                reject(errors(labels.LBL_USER_NOT_FOUND[config.default_language], responseCodes.ResourceNotFound));
                return;
            }
            let job = await query.selectWithAndOne(dbConstants.dbSchema.jobs, {job_id:requestParam.job_id}, { _id:0, job_id: 1, status:1} );
            if(!job){
                reject(errors(labels.LBL_JOB_NOT_FOUND[config.default_language], responseCodes.ResourceNotFound));
                return;
            }
            if(job.status != 'new'){
                reject(errors(labels.LBL_YOU_CAN_NOT_CANCEL_JOB[config.default_language], responseCodes.ResourceNotFound));
                return;
            }
            await query.updateSingle(dbConstants.dbSchema.jobs, {status:'cancelled'}, {job_id: requestParam.job_id});
            resolve(await encryptDecryptHandler.encrypt({}));
            return;
        } catch (error) {
            console.log(error)
            reject(error)
            return
        }
    })
};

const trackJob = async(requestParam) => {
    return new Promise(async(resolve, reject) => {
        try {
            let response = await query.selectWithAndOne(dbConstants.dbSchema.customers, {customer_id:requestParam.customer_id}, { _id:0, customer_id: 1} );
            if(!response){
                reject(errors(labels.LBL_USER_NOT_FOUND[config.default_language], responseCodes.ResourceNotFound));
                return;
            }
            let job = await query.selectWithAndOne(dbConstants.dbSchema.jobs, {job_id:requestParam.job_id}, { _id:0, job_id: 1, status:1, pickup_address:1, delivery_address:1} );
            if(!job){
                reject(errors(labels.LBL_JOB_NOT_FOUND[config.default_language], responseCodes.ResourceNotFound));
                return;
            }
            resolve(await encryptDecryptHandler.encrypt(job));
            return;
        } catch (error) {
            console.log(error)
            reject(error)
            return
        }
    })
};

const rateJob = async(requestParam) => {
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
            requestParam.rating = parseFloat(requestParam.rating).toFixed(1)
            let obj = {rating: requestParam.rating, date: new Date()}
            if(requestParam.comment){
                obj.comment = requestParam.comment
            }
            await query.updateSingle(dbConstants.dbSchema.jobs, {rating: obj, is_customer_rated:true}, {job_id: requestParam.job_id});
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
    register,
    signin,
    updateProfile,
    profile,
    checkPrice,
    createJob,
    createOrder,
    updateJob,
    changePassword,
    logoutDelete,
    applyCoupon,
    uploadItemImgae,
    getCurrentDelivery,
    deliveryHistory,
    cancelJob,
    recentlyShipped,
    trackJob,
    rateJob,
};