'use strict';

const config = require('./../config');
const errors = require('./../utils/dz-errors');
const dbConstants = require('./../constants/db-constants');
const query = require('./../utils/query-creator');
const coupon = require('./../models/coupon');
const _ = require('underscore');
const labels = require('./../utils/labels.json');
const responseCodes = require('./../utils/response-codes');
const timeZone = require('moment-timezone');

const get = async(requestParam) => {
    return new Promise(async(resolve, reject) => {
        try {
            let columnValue = {}
            if(requestParam.coupon_id){
                columnValue.coupon_id = requestParam.coupon_id
            }
            let response = await query.selectWithAnd(dbConstants.dbSchema.coupons, columnValue, { _id: 0}, { created_at: 1 });
            if(requestParam.coupon_id){
                response = response[0]
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
                    coupon_id: new RegExp(requestParam.text, 'i')
                }, {
                    title: new RegExp(requestParam.text, 'i')
                }, {
                    coupon_code: new RegExp(requestParam.text, 'i')
                }, {
                    start_date: new RegExp(requestParam.text, 'i')
                }, {
                    end_date: new RegExp(requestParam.text, 'i')
                }, {
                    type: new RegExp(requestParam.text, 'i')
                }, {
                    value: new RegExp(requestParam.text, 'i')
                }, {
                    status: new RegExp(requestParam.text, 'i')
                }];
            }
            let page = requestParam.page ? requestParam.page : 0 ;
            let sizePerPage = requestParam.sizePerPage ? requestParam.sizePerPage : 10 ;
            let skip = page * sizePerPage;
            let obj = {};

            let count = await query.countRecord(dbConstants.dbSchema.coupons, columnAndValue)
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
                }
            }];
            let data = await query.joinWithAnd(dbConstants.dbSchema.coupons, joinArr);
            data = JSON.parse(JSON.stringify(data))
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

const create = async(requestParam) => {
    return new Promise(async(resolve, reject) => {
        try {
            requestParam.start_date = timeZone(new Date(requestParam.start_date)).tz(requestParam.time_zone).format('YYYY-MM-DD')
            requestParam.end_date = timeZone(new Date(requestParam.end_date)).tz(requestParam.time_zone).format('YYYY-MM-DD')
            let response = await query.selectWithAndOne(dbConstants.dbSchema.coupons, {coupon_code: requestParam.coupon_code}, { _id: 0, coupon_id:1}, { created_at: 1 });
            if(response){
                reject(errors(labels.LBL_RECORD_ALREADY_EXISTS[config.default_language], responseCodes.ResourceNotFound));
                return;
            }
            await query.insertSingle(dbConstants.dbSchema.coupons, requestParam);
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
            requestParam.start_date = timeZone(new Date(requestParam.start_date)).tz(requestParam.time_zone).format('YYYY-MM-DD')
            requestParam.end_date = timeZone(new Date(requestParam.end_date)).tz(requestParam.time_zone).format('YYYY-MM-DD')
            let compareColumnAndValues = {
                coupon_id: { $ne: requestParam.coupon_id },
                coupon_code: requestParam.coupon_code
            };
            let response = await query.selectWithAndOne(dbConstants.dbSchema.coupons, compareColumnAndValues, { _id: 0, coupon_id:1}, { created_at: 1 });
            if(response){
                reject(errors(labels.LBL_RECORD_ALREADY_EXISTS[config.default_language], responseCodes.ResourceNotFound));
                return;
            }
            await query.updateSingle(dbConstants.dbSchema.coupons, requestParam, {coupon_id: requestParam.coupon_id});
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
                await query.removeMultiple(dbConstants.dbSchema.coupons, { coupon_id: { $in: requestParam['ids']}});
            }
            else{
                await query.updateMultiple(dbConstants.dbSchema.coupons, {status: requestParam.type}, {coupon_id: { $in: requestParam['ids']}});
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
    getSort,
    create,
    update,
    action,
};