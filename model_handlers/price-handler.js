'use strict';

const config = require('./../config');
const errors = require('./../utils/dz-errors');
const dbConstants = require('./../constants/db-constants');
const query = require('./../utils/query-creator');
const price = require('./../models/vehicle-price');
const _ = require('underscore');
const labels = require('./../utils/labels.json');
const responseCodes = require('./../utils/response-codes');
const timeZone = require('moment-timezone');

const get = async(requestParam) => {
    return new Promise(async(resolve, reject) => {
        try {
            let columnValue = {}
            if(requestParam.price_id){
                columnValue.price_id = requestParam.price_id
            }
            if(requestParam.status){
                columnValue.status = requestParam.status
            }
            let response = await query.selectWithAnd(dbConstants.dbSchema.vehicle_prices, columnValue, { _id: 0}, { created_at: 1 });
            if(requestParam.price_id){
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
                    price_id: new RegExp(requestParam.text, 'i')
                }, {
                    base_fare: new RegExp(requestParam.text, 'i')
                }, {
                    per_km_fare: new RegExp(requestParam.text, 'i')
                }, {
                    per_hour_fare: new RegExp(requestParam.text, 'i')
                }, {
                    'vehDetails.name': new RegExp(requestParam.text, 'i')
                }, {
                    'delDetails.name': new RegExp(requestParam.text, 'i')
                }];
            }
            let page = requestParam.page ? requestParam.page : 0 ;
            let sizePerPage = requestParam.sizePerPage ? requestParam.sizePerPage : 10 ;
            let skip = page * sizePerPage;
            let obj = {};

            let count = await query.countRecord(dbConstants.dbSchema.vehicle_prices, columnAndValue);

            let joinArr = [{
                $lookup: {
                    from: 'vehicles',
                    localField: 'vehicle_id',
                    foreignField: 'vehicle_id',
                    as: 'vehDetails',
                },
            }, {
                $unwind: "$vehDetails"
            }, {
                $lookup: {
                    from: 'delivery_options',
                    localField: 'delivery_option_id',
                    foreignField: 'delivery_option_id',
                    as: 'delDetails',
                },
            }, {
                $unwind: "$delDetails"
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
                    price_id: 1,
                    base_fare: 1,
                    per_km_fare: 1,
                    per_hour_fare: 1,
                    vehicle: "$vehDetails.name",
                    delivery_option: "$delDetails.name",
                }
            }];
            let data = await query.joinWithAnd(dbConstants.dbSchema.vehicle_prices, joinArr);
            data = JSON.parse(JSON.stringify(data))

            let settings = await query.selectWithAndOne(dbConstants.dbSchema.settings, {}, { _id: 0, currency:1}, { created_at: 1 });
            let currency = settings ? settings.currency : 'TZS'

            _.each(data, (elem) => {
                elem.base_fare = elem.base_fare +' '+ currency
                elem.per_km_fare = elem.per_km_fare +' '+ currency
                elem.per_hour_fare = elem.per_hour_fare +' '+ currency
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

const create = async(requestParam) => {
    return new Promise(async(resolve, reject) => {
        try {
            let response = await query.selectWithAndOne(dbConstants.dbSchema.vehicle_prices, {vehicle_id: requestParam.vehicle_id, delivery_option_id: requestParam.delivery_option_id}, { _id: 0, price_id:1}, { created_at: 1 });
            if(response){
                reject(errors(labels.LBL_RECORD_ALREADY_EXISTS[config.default_language], responseCodes.ResourceNotFound));
                return;
            }
            await query.insertSingle(dbConstants.dbSchema.vehicle_prices, requestParam);
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
                vehicle_id: requestParam.vehicle_id,
                delivery_option_id: requestParam.delivery_option_id,
                price_id: {
                    $ne: requestParam.price_id
                }
            };
            let response = await query.selectWithAndOne(dbConstants.dbSchema.vehicle_prices, compareColumnAndValues, { _id: 0, price_id:1}, { created_at: 1 });
            if(response){
                reject(errors(labels.LBL_RECORD_ALREADY_EXISTS[config.default_language], responseCodes.ResourceNotFound));
                return;
            }
            await query.updateSingle(dbConstants.dbSchema.vehicle_prices, requestParam, {price_id: requestParam.price_id});
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
                await query.removeMultiple(dbConstants.dbSchema.vehicle_prices, { price_id: { $in: requestParam['ids']}});
            }
            else{
                await query.updateMultiple(dbConstants.dbSchema.vehicle_prices, {status: requestParam.type}, {price_id: { $in: requestParam['ids']}});
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
    action
};