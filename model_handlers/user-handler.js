'use strict';

const config = require('./../config');
const errors = require('./../utils/dz-errors');
const dbConstants = require('./../constants/db-constants');
const query = require('./../utils/query-creator');
const user = require('./../models/user');
const _ = require('underscore');
const labels = require('./../utils/labels.json');
const responseCodes = require('./../utils/response-codes');
const timeZone = require('moment-timezone');
const passwordHandler = require('./../utils/password-handler');

const get = async(requestParam) => {
    return new Promise(async(resolve, reject) => {
        try {
            let columnValue = {}
            if(requestParam.user_id){
                columnValue.user_id = requestParam.user_id
            }
            if(requestParam.status){
                columnValue.status = requestParam.status
            }
            if(requestParam.type){
                if(requestParam.type == 'money-agent'){
                    columnValue.status = 'active'
                    let role = await query.selectWithAndOne(dbConstants.dbSchema.roles, {title:'Money agent'}, { _id: 0, role_id:1}, { created_at: 1 });
                    if(role) {
                        columnValue.role_id = role.role_id
                    }
                }
            }
            let response = await query.selectWithAnd(dbConstants.dbSchema.users, columnValue, { _id: 0}, { created_at: 1 });
            if(requestParam.user_id){
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
                    user_id: new RegExp(requestParam.text, 'i')
                }, {
                    name: new RegExp(requestParam.text, 'i')
                }, {
                    email: new RegExp(requestParam.text, 'i')
                }, {
                    mobile: new RegExp(requestParam.text, 'i')
                }, {
                    status: new RegExp(requestParam.text, 'i')
                }, {
                    "roleDetails.title": new RegExp(requestParam.text, 'i')
                }, ];
            }
            let page = requestParam.page ? requestParam.page : 0 ;
            let sizePerPage = requestParam.sizePerPage ? requestParam.sizePerPage : 10 ;
            let skip = page * sizePerPage;
            let obj = {};

            let count = await query.countRecord(dbConstants.dbSchema.users, columnAndValue);

            let joinArr = [{
                $lookup: {
                    from: 'roles',
                    localField: 'role_id',
                    foreignField: 'role_id',
                    as: 'roleDetails',
                },
            }, {
                $unwind: "$roleDetails"
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
                    user_id: 1,
                    name: 1,
                    email: 1,
                    mobile: 1,
                    status: 1,
                    created_at: 1,
                    role: "$roleDetails.title",
                }
            }];
            let data = await query.joinWithAnd(dbConstants.dbSchema.users, joinArr);
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
            requestParam.email = requestParam.email.trim();
            let regexEmail = new RegExp(['^', requestParam.email, '$'].join(''), 'i');
            let compareColumnAndValues = {
                $or: [{
                    email: regexEmail
                }, {
                    mobile: requestParam.mobile,
                }]
            };
            let response = await query.selectWithAndOne(dbConstants.dbSchema.users, compareColumnAndValues, { _id: 0, user_id:1}, { created_at: 1 });
            if(response){
                reject(errors(labels.LBL_EMAIL_OR_MOBILE_ALREADY_EXISTS[config.default_language], responseCodes.ResourceNotFound));
                return;
            }
            requestParam.password = await passwordHandler.encrypt(requestParam.password.toString())
            await query.insertSingle(dbConstants.dbSchema.users, requestParam);
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
            requestParam.email = requestParam.email.trim();
            let regexEmail = new RegExp(['^', requestParam.email, '$'].join(''), 'i');
            let compareColumnAndValues = {
                $and: [{
                    $or: [{
                        email: regexEmail
                    }, {
                        mobile: requestParam.mobile,
                    }]
                }, {
                    user_id: {
                        $ne: requestParam.user_id
                    }
                }]
            };
            let response = await query.selectWithAndOne(dbConstants.dbSchema.users, compareColumnAndValues, { _id: 0, user_id:1}, { created_at: 1 });
            if(response){
                reject(errors(labels.LBL_EMAIL_OR_MOBILE_ALREADY_EXISTS[config.default_language], responseCodes.ResourceNotFound));
                return;
            }
            await query.updateSingle(dbConstants.dbSchema.users, requestParam, {user_id: requestParam.user_id});
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
                await query.removeMultiple(dbConstants.dbSchema.users, { user_id: { $in: requestParam['ids']}});
            }
            else{
                await query.updateMultiple(dbConstants.dbSchema.users, {status: requestParam.type}, {user_id: { $in: requestParam['ids']}});
            }
            resolve({});
            return;
        } catch (error) {
            reject(error)
            return
        }
    })
};

const changePassword = async(requestParam) => {
    return new Promise(async(resolve, reject) => {
        try {
            requestParam.password = await passwordHandler.encrypt(requestParam.password.toString())
            await query.updateSingle(dbConstants.dbSchema.users, requestParam, {user_id: requestParam.user_id});
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
    changePassword
};