'use strict';

const config = require('./../config');
const errors = require('./../utils/dz-errors');
const dbConstants = require('./../constants/db-constants');
const query = require('./../utils/query-creator');
const settings = require('./../models/settings');
const _ = require('underscore');
const labels = require('./../utils/labels.json');
const responseCodes = require('./../utils/response-codes');
const timeZone = require('moment-timezone');

const get = async(requestParam) => {
    return new Promise(async(resolve, reject) => {
        try {
            let response = await query.selectWithAndOne(dbConstants.dbSchema.settings, {}, { _id: 0}, { created_at: 1 });
            if(!response){
                resolve({});
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

const update = async(requestParam, req) => {
    return new Promise(async(resolve, reject) => {
        try {
            let response = await query.selectWithAndOne(dbConstants.dbSchema.settings, {}, { _id: 0}, { created_at: 1 });
            if(response){
                await query.updateSingle(dbConstants.dbSchema.settings, requestParam, {settings_id: response.settings_id});
            }
            else{
                await query.insertSingle(dbConstants.dbSchema.settings, requestParam);
            }
            resolve({});
            return;
        } catch (error) {
            reject(error)
            return
        }
    })
};

module.exports = {
    get,
    update,
};