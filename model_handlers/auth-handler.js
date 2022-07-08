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
            resolve(response);
            return;
        } catch (error) {
            console.log(error)
            reject(error)
            return
        }
    })
};

module.exports = {
    login
};