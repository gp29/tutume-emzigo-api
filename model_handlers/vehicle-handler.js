'use strict';

const config = require('./../config');
const errors = require('./../utils/dz-errors');
const dbConstants = require('./../constants/db-constants');
const query = require('./../utils/query-creator');
const vehicle = require('./../models/vehicle');
const _ = require('underscore');
const labels = require('./../utils/labels.json');
const responseCodes = require('./../utils/response-codes');
const timeZone = require('moment-timezone');
const imgHandler = require('./../model_handlers/image-handler');

const get = async(requestParam) => {
    return new Promise(async(resolve, reject) => {
        try {
            let columnValue = {}
            if(requestParam.vehicle_id){
                columnValue.vehicle_id = requestParam.vehicle_id
            }
            if(requestParam.status){
                columnValue.status = requestParam.status
            }
            let response = await query.selectWithAnd(dbConstants.dbSchema.vehicles, columnValue, { _id: 0, created_at:0, updated_at:0, __v:0}, { created_at: 1 });
            if(requestParam.vehicle_id){
                response = response[0]
                response.icon = response.icon != '' ? await imgHandler.getImage({bucket: config.aws.bucketName, key:`emzigo/vehicles/${response.icon}`}) : ''
                resolve(response);
                return;
            }
            await Promise.all(response.map(async (elem) => {
                elem.icon = elem.icon != '' ? await imgHandler.getImage({bucket: config.aws.bucketName, key:`emzigo/vehicles/${elem.icon}`}) : ''
            }))
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
                    vehicle_id: new RegExp(requestParam.text, 'i')
                }, {
                    name: new RegExp(requestParam.text, 'i')
                }, {
                    weight: new RegExp(requestParam.text, 'i')
                }, {
                    status: new RegExp(requestParam.text, 'i')
                }];
            }
            let page = requestParam.page ? requestParam.page : 0 ;
            let sizePerPage = requestParam.sizePerPage ? requestParam.sizePerPage : 10 ;
            let skip = page * sizePerPage;
            let obj = {};

            let count = await query.countRecord(dbConstants.dbSchema.vehicles, columnAndValue)
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
            let data = await query.joinWithAnd(dbConstants.dbSchema.vehicles, joinArr);
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

const create = async(requestParam, req) => {
    return new Promise(async(resolve, reject) => {
        try {
            let response = await query.selectWithAndOne(dbConstants.dbSchema.vehicles, {name: requestParam.name}, { _id: 0, vehicle_id:1}, { created_at: 1 });
            if(response){
                reject(errors(labels.LBL_RECORD_ALREADY_EXISTS[config.default_language], responseCodes.ResourceNotFound));
                return;
            }
            if(req.files){
                if(req.files.icon){
                    requestParam.icon = await imgHandler.uploadImage(req.files.icon, config.aws.s3.vehicleBucket)
                }
            }
            await query.insertSingle(dbConstants.dbSchema.vehicles, requestParam);
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
            let response = await query.selectWithAndOne(dbConstants.dbSchema.vehicles, {name: requestParam.name, vehicle_id:{$ne: requestParam.vehicle_id}}, { _id: 0, vehicle_id:1}, { created_at: 1 });
            if(response){
                reject(errors(labels.LBL_RECORD_ALREADY_EXISTS[config.default_language], responseCodes.ResourceNotFound));
                return;
            }
            let vehicle = await query.selectWithAndOne(dbConstants.dbSchema.vehicles, {vehicle_id: requestParam.vehicle_id}, { _id: 0, icon:1}, { created_at: 1 });
            if (requestParam.change_logo) {
                const objects = [{
                    Key: `emzigo/vehicles/${vehicle.icon}`
                }];
                await imgHandler.deleteImage(objects, config.aws.bucketName)
                requestParam.icon = await imgHandler.uploadImage(req.files.icon, config.aws.s3.vehicleBucket)
            }
            else{
                delete requestParam.icon
            }
            await query.updateSingle(dbConstants.dbSchema.vehicles, requestParam, {vehicle_id: requestParam.vehicle_id});
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
                let response = await query.selectWithAnd(dbConstants.dbSchema.vehicles, {vehicle_id: {$in: requestParam.ids}}, { _id: 0, vehicle_id:1, icon:1}, { created_at: 1 });
                let objects = []
                await Promise.all(response.map(async (elem) => {
                    objects.push({
                        Key: `emzigo/vehicles/${elem.icon}`
                    });
                }))
                if(objects.length > 0) await imgHandler.deleteImage(objects, config.aws.bucketName)
                await query.removeMultiple(dbConstants.dbSchema.vehicles, { vehicle_id: { $in: requestParam['ids']}});
                await query.removeMultiple(dbConstants.dbSchema.vehicle_prices, { vehicle_id: { $in: requestParam['ids']}});
            }
            else{
                await query.updateMultiple(dbConstants.dbSchema.vehicles, {status: requestParam.type}, {vehicle_id: { $in: requestParam['ids']}});
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