'use strict';

const config = require('./../../config');
const errors = require('./../../utils/dz-errors');
const dbConstants = require('./../../constants/db-constants');
const query = require('./../../utils/query-creator');
const _ = require('underscore');
const labels = require('./../../utils/labels.json');
const responseCodes = require('./../../utils/response-codes');
const moment = require('moment');
const timeZone = require('moment-timezone');
const riderHandler = require('./../../model_handlers/petrol-modules/rider-handler');
const encryptDecryptHandler = require('./../../model_handlers/encrypt-decrypt-handler');
const passwordHandler = require('./../../utils/password-handler');
const LD = require('lodash');
const imgHandler = require('./../../model_handlers/image-handler');

const signin = async(requestParam, req) => {
    return new Promise(async(resolve, reject) => {
        try {
            let response = await query.selectWithAndOne(dbConstants.dbSchema.users, {mobile:requestParam.mobile}, { _id:0, user_id:1, name:1, mobile:1, status:1, password:1, email:1} );
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
            resolve(profile({user_id: response.user_id, time_zone: requestParam.time_zone}));
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
            let response = await query.selectWithAndOne(dbConstants.dbSchema.users, {user_id:requestParam.user_id}, { _id:0, user_id:1, name:1, email:1, mobile:1, status:1} );
            if(!response){
                reject(errors(labels.LBL_USER_NOT_FOUND[config.default_language], responseCodes.ResourceNotFound));
                return;
            }
            response = JSON.parse(JSON.stringify(response))
            if(response.status == 'inactive'){
                reject(errors(labels.LBL_ACCOUNT_INACTIVE[config.default_language], responseCodes.NotActive));
                return;
            }
            response.user_type = 'mwenyekiti'
            response.user_id = response.user_id
            resolve(await encryptDecryptHandler.encrypt(response));
            return;
        } catch (error) {
            console.log(error)
            reject(error)
            return
        }
    })
};

const riderList = async(requestParam) => {
    return new Promise(async(resolve, reject) => {
        try {
            let page = (requestParam.page ? requestParam.page : 1);
            let limit = 20;
            page -= 1;
            let skip = page * limit;

            let response = await query.selectWithAndOne(dbConstants.dbSchema.users, {user_id:requestParam.user_id}, { _id:0, user_id:1} );
            if(!response){
                reject(errors(labels.LBL_USER_NOT_FOUND[config.default_language], responseCodes.ResourceNotFound));
                return;
            }
            let lists = await query.selectWithAndFilter(dbConstants.dbSchema.riders, {user_id: requestParam.user_id}, { _id:0, rider_id:1, name:1, mobile:1, status:1, profile_photo:1}, { created_at: -1 }, {skip, limit});
            lists = JSON.parse(JSON.stringify(lists))
            await Promise.all(lists.map(async (elem) => {
                elem.profile_photo = elem.profile_photo != '' ? await imgHandler.getImage({bucket: config.aws.bucketName, key:`emzigo/riders/${elem.profile_photo}`}) : ''
                elem.status = LD.upperFirst(elem.status)
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

const regionList = async(requestParam) => {
    return new Promise(async(resolve, reject) => {
        try {
            let response = await query.selectWithAndOne(dbConstants.dbSchema.users, {user_id:requestParam.user_id}, { _id:0, user_id:1} );
            if(!response){
                reject(errors(labels.LBL_USER_NOT_FOUND[config.default_language], responseCodes.ResourceNotFound));
                return;
            }
            let lists = await query.selectWithAnd(dbConstants.dbSchema.regions, {status:'active'}, { _id:0, region_id:1, name:1}, {created_at: -1} );
            lists = JSON.parse(JSON.stringify(lists))
            resolve(await encryptDecryptHandler.encrypt(lists));
            return;
        } catch (error) {
            console.log(error)
            reject(error)
            return
        }
    })
};

const kijiweList = async(requestParam) => {
    return new Promise(async(resolve, reject) => {
        try {
            let response = await query.selectWithAndOne(dbConstants.dbSchema.users, {user_id:requestParam.user_id}, { _id:0, user_id:1} );
            if(!response){
                reject(errors(labels.LBL_USER_NOT_FOUND[config.default_language], responseCodes.ResourceNotFound));
                return;
            }
            let lists = await query.selectWithAnd(dbConstants.dbSchema.kijiwes, {status:'active', region_id: requestParam.region_id}, { _id:0, kijiwe_id:1, name:1}, {created_at: -1} );
            lists = JSON.parse(JSON.stringify(lists))
            resolve(await encryptDecryptHandler.encrypt(lists));
            return;
        } catch (error) {
            console.log(error)
            reject(error)
            return
        }
    })
};

const vehicleList = async(requestParam) => {
    return new Promise(async(resolve, reject) => {
        try {
            let response = await query.selectWithAndOne(dbConstants.dbSchema.users, {user_id:requestParam.user_id}, { _id:0, user_id:1} );
            if(!response){
                reject(errors(labels.LBL_USER_NOT_FOUND[config.default_language], responseCodes.ResourceNotFound));
                return;
            }
            let lists = await query.selectWithAnd(dbConstants.dbSchema.vehicles, {status:'active'}, { _id:0, vehicle_id:1, name:1, weight:1}, {created_at: -1} );
            lists = JSON.parse(JSON.stringify(lists))
            resolve(await encryptDecryptHandler.encrypt(lists));
            return;
        } catch (error) {
            console.log(error)
            reject(error)
            return
        }
    })
};

const createRider = async(requestParam, req) => {
    return new Promise(async(resolve, reject) => {
        try {
            if(requestParam.user_id){
                requestParam.user_id = await encryptDecryptHandler.decryptString(requestParam.user_id)
            }
            if(requestParam.name){
                requestParam.name = await encryptDecryptHandler.decryptString(requestParam.name)
            }
            if(requestParam.mobile){
                requestParam.mobile = await encryptDecryptHandler.decryptString(requestParam.mobile)
            }
            if(requestParam.email){
                requestParam.email = await encryptDecryptHandler.decryptString(requestParam.email)
            }
            if(requestParam.password){
                requestParam.password = await encryptDecryptHandler.decryptString(requestParam.password)
            }
            if(requestParam.address){
                requestParam.address = await encryptDecryptHandler.decryptString(requestParam.address)
            }
            if(requestParam.nida_number){
                requestParam.nida_number = await encryptDecryptHandler.decryptString(requestParam.nida_number)
            }
            if(requestParam.region_id){
                requestParam.region_id = await encryptDecryptHandler.decryptString(requestParam.region_id)
            }
            if(requestParam.kijiwe_id){
                requestParam.kijiwe_id = await encryptDecryptHandler.decryptString(requestParam.kijiwe_id)
            }
            if(requestParam.vehicle_id){
                requestParam.vehicle_id = await encryptDecryptHandler.decryptString(requestParam.vehicle_id)
            }
            if(requestParam.referee_name){
                requestParam.referee_name = await encryptDecryptHandler.decryptString(requestParam.referee_name)
            }
            if(requestParam.referee_contact_number){
                requestParam.referee_contact_number = await encryptDecryptHandler.decryptString(requestParam.referee_contact_number)
            }
            if(requestParam.fuel_credit_limit){
                requestParam.fuel_credit_limit = await encryptDecryptHandler.decryptString(requestParam.fuel_credit_limit)
            }
            let response = await query.selectWithAndOne(dbConstants.dbSchema.users, {user_id:requestParam.user_id}, { _id:0, user_id:1} );
            if(!response){
                reject(errors(labels.LBL_USER_NOT_FOUND[config.default_language], responseCodes.ResourceNotFound));
                return;
            }
            let compareColumnAndValues = {mobile: requestParam.mobile}
            if(requestParam.email && requestParam.email != ''){
                requestParam.email = requestParam.email.trim();
                let regexEmail = new RegExp(['^', requestParam.email, '$'].join(''), 'i');
                compareColumnAndValues = {
                    $or: [{
                        email: regexEmail
                    }, {
                        mobile: requestParam.mobile,
                    }]
                };
            }
            let exists = await query.selectWithAndOne(dbConstants.dbSchema.riders, compareColumnAndValues, { _id: 0, rider_id:1}, { created_at: 1 });
            if(exists){
                reject(errors(labels.LBL_EMAIL_OR_MOBILE_ALREADY_EXISTS[config.default_language], responseCodes.Conflict));
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
            requestParam.account_number = await riderHandler.generateAccountNumber();
            requestParam.password = await passwordHandler.encrypt(requestParam.password.toString());
            requestParam.status = 'inactive'
            await query.insertSingle(dbConstants.dbSchema.riders, requestParam);
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
    signin,
    profile,
    riderList,
    regionList,
    kijiweList,
    vehicleList,
    createRider
};