'use strict';

const config = require('./../../config');
const errors = require('./../../utils/dz-errors');
const dbConstants = require('./../../constants/db-constants');
const query = require('./../../utils/query-creator');
const headquarter = require('./../../models/head-quarter');
const _ = require('underscore');
const labels = require('./../../utils/labels.json');
const responseCodes = require('./../../utils/response-codes');
const timeZone = require('moment-timezone');

const get = async(requestParam) => {
    return new Promise(async(resolve, reject) => {
        try {
            let columnValue = {}
            if(requestParam.head_quarter_id){
                columnValue.head_quarter_id = requestParam.head_quarter_id
            }
            if(requestParam.status){
                columnValue.status = requestParam.status
            }
            let response = await query.selectWithAnd(dbConstants.dbSchema.head_quarters, columnValue, { _id: 0}, { created_at: 1 });
            if(requestParam.head_quarter_id){
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
                    head_quarter_id: new RegExp(requestParam.text, 'i')
                }, {
                    name: new RegExp(requestParam.text, 'i')
                }, {
                    status: new RegExp(requestParam.text, 'i')
                }];
            }
            let page = requestParam.page ? requestParam.page : 0 ;
            let sizePerPage = requestParam.sizePerPage ? requestParam.sizePerPage : 10 ;
            let skip = page * sizePerPage;
            let obj = {};

            let joinArr = [{
                $lookup: {
                    from: 'products',
                    localField: 'product_id',
                    foreignField: 'product_id',
                    as: 'productDetails',
                },
            }, {
                "$unwind": {
                    "path": "$productDetails",
                    "preserveNullAndEmptyArrays": true
                }
            }, { 
                $match : columnAndValue
            }, { 
                $sort : {created_at:-1}
            }, {
                $project: {
                    _id: 0,
                    head_quarter_id: "$head_quarter_id"
                }
            }];
            let count = await query.joinWithAnd(dbConstants.dbSchema.head_quarters, joinArr);

            joinArr = [{
                $lookup: {
                    from: 'products',
                    localField: 'product_id',
                    foreignField: 'product_id',
                    as: 'productDetails',
                },
            }, {
                "$unwind": {
                    "path": "$productDetails",
                    "preserveNullAndEmptyArrays": true
                }
            }, { 
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
                    head_quarter_id: "$head_quarter_id",
                    name: "$name",
                    status: "$status",
                    product: "$productDetails",
                }
            }];
            let data = await query.joinWithAnd(dbConstants.dbSchema.head_quarters, joinArr);
            data = JSON.parse(JSON.stringify(data))
            _.each(data, (elem) => {
                elem.product = elem.product ? elem.product.name : ''
            })
            obj.data = data;
            obj.count = count.length;
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
            let response = await query.selectWithAndOne(dbConstants.dbSchema.head_quarters, {name: requestParam.name}, { _id: 0, head_quarter_id:1}, { created_at: 1 });
            if(response){
                reject(errors(labels.LBL_RECORD_ALREADY_EXISTS[config.default_language], responseCodes.ResourceNotFound));
                return;
            }
            await query.insertSingle(dbConstants.dbSchema.head_quarters, requestParam);
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
            let compareColumnAndValues = {
                head_quarter_id: { $ne: requestParam.head_quarter_id },
                name: requestParam.name, 
            };
            let response = await query.selectWithAndOne(dbConstants.dbSchema.head_quarters, compareColumnAndValues, { _id: 0, head_quarter_id:1}, { created_at: 1 });
            if(response){
                reject(errors(labels.LBL_RECORD_ALREADY_EXISTS[config.default_language], responseCodes.ResourceNotFound));
                return;
            }
            await query.updateSingle(dbConstants.dbSchema.head_quarters, requestParam, {head_quarter_id: requestParam.head_quarter_id});
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
                await query.removeMultiple(dbConstants.dbSchema.head_quarters, { head_quarter_id: { $in: requestParam['ids']}});
            }
            else{
                await query.updateMultiple(dbConstants.dbSchema.head_quarters, {status: requestParam.type}, {head_quarter_id: { $in: requestParam['ids']}});
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