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
            let response = await query.selectWithAndOne(dbConstants.dbSchema.users, {user_id:requestParam.user_id}, { _id:0, user_id:1} );
            if(!response){
                reject(errors(labels.LBL_USER_NOT_FOUND[config.default_language], responseCodes.ResourceNotFound));
                return;
            }
            let lists = await query.selectWithAnd(dbConstants.dbSchema.riders, {user_id:requestParam.user_id}, { _id:0, rider_id:1, name:1, mobile:1, status:1, profile_photo:1}, {created_at: -1} );
            lists = JSON.parse(JSON.stringify(lists))
            await Promise.all(lists.map(async (elem) => {
                elem.profile_photo = elem.profile_photo != '' ? await imgHandler.getImage({bucket: config.aws.bucketName, key:`emzigo/riders/${elem.profile_photo}`}) : ''
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

module.exports = {
    signin,
    profile,
    riderList,
    regionList,
    kijiweList,
    vehicleList
};