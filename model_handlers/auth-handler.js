'use strict';

const config = require('./../config');
const errors = require('./../utils/dz-errors');
const dbConstants = require('./../constants/db-constants');
const query = require('./../utils/query-creator');
const user = require('./../models/user');
const _ = require('underscore');
const labels = require('./../utils/labels.json');
const responseCodes = require('./../utils/response-codes');
const passwordHandler = require('./../utils/password-handler');

const login = async(requestParam) => {
    return new Promise(async(resolve, reject) => {
        try {
            let response = await query.selectWithAndOne(dbConstants.dbSchema.users, {mobile: requestParam.mobile}, { _id: 0}, { created_at: 1 });
            if (!response) {
                reject(errors(labels.LBL_MOBILE_NOT_FOUND[config.default_language], responseCodes.ResourceNotFound));
                return;
            }
            response = JSON.parse(JSON.stringify(response))
            if(response.status == 'inactive'){
                reject(errors(labels.LBL_ACCOUNT_INACTIVE[config.default_language], responseCodes.ResourceNotFound));
                return;
            }
            let encryptPassword = await passwordHandler.encrypt(requestParam.password.toString());
            if(encryptPassword != response.password){
                reject(errors(labels.LBL_INVALID_PWD[config.default_language], responseCodes.ResourceNotFound));
                return;
            }
            const inserRecord = {
                mobile: response.mobile,
                name: response.name,
                type: 'Admin',
                login_id: response.user_id,
                ip: requestParam.ip_address,
            };
            let res = await query.insertSingle(dbConstants.dbSchema.login_logs, inserRecord)
            response = JSON.parse(JSON.stringify(response));
            response.loginlog_id = res.loginlog_id

            response.role = ''
            let role = await query.selectWithAndOne(dbConstants.dbSchema.roles, {role_id: response.role_id}, { _id: 0}, { created_at: 1 });
            if (role) {
                response.role = role.title
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

const logout = async(requestParam) => {
    return new Promise(async(resolve, reject) => {
        try {
            requestParam['logout_date'] = new Date();
            await query.updateSingle(dbConstants.dbSchema.login_logs, requestParam, {loginlog_id: requestParam.loginlog_id});
            resolve({});
            return;
        } catch (error) {
            reject(error)
            return
        }
    })
};

module.exports = {
    login,
    logout
};