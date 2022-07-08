'use strict';

const config = require('./../config');
const errors = require('./../utils/dz-errors');
const dbConstants = require('./../constants/db-constants');
const query = require('./../utils/query-creator');
const setting = require('./../models/settings');
const labels = require('./../utils/labels.json');
const responseCodes = require('./../utils/response-codes');

const get = async(requestParam) => {
    return new Promise(async(resolve, reject) => {
        try {
            let settings = await query.selectWithAndOne(dbConstants.dbSchema.settings, {}, { _id: 0}, {});
            resolve(settings);
            return;
        } catch (error) {
            reject(error)
            return
        }
    })
};

module.exports = {
    get
};