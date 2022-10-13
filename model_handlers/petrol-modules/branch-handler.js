'use strict';

const config = require('./../../config');
const errors = require('./../../utils/dz-errors');
const dbConstants = require('./../../constants/db-constants');
const query = require('./../../utils/query-creator');
const branch = require('./../../models/branch');
const branch_activity = require('./../../models/branch-activity');
const _ = require('underscore');
const labels = require('./../../utils/labels.json');
const responseCodes = require('./../../utils/response-codes');
const timeZone = require('moment-timezone');
const passwordHandler = require('./../../utils/password-handler');
const idGenerator = require('./../../utils/id-generator');
const imgHandler = require('./../../model_handlers/image-handler');
const encryptDecryptHandler = require('./../../model_handlers/encrypt-decrypt-handler');

const get = async(requestParam) => {
    return new Promise(async(resolve, reject) => {
        try {
            let columnValue = {}
            if(requestParam.branch_id){
                columnValue.branch_id = requestParam.branch_id
            }
            if(requestParam.status){
                columnValue.status = requestParam.status
            }
            let response = await query.selectWithAnd(dbConstants.dbSchema.branches, columnValue, { _id: 0}, { created_at: 1 });
            if(requestParam.branch_id){
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
                    branch_id: new RegExp(requestParam.text, 'i')
                }, {
                    branch_name: new RegExp(requestParam.text, 'i')
                }, {
                    "headDetails.name": new RegExp(requestParam.text, 'i')
                }, {
                    registration_id: new RegExp(requestParam.text, 'i')
                }, {
                    contact_no: new RegExp(requestParam.text, 'i')
                }, {
                    contact_email: new RegExp(requestParam.text, 'i')
                }];
            }
            let page = requestParam.page ? requestParam.page : 0 ;
            let sizePerPage = requestParam.sizePerPage ? requestParam.sizePerPage : 10 ;
            let skip = page * sizePerPage;
            let obj = {};

            let joinArr = [{
                $lookup: {
                    from: 'head_quarters',
                    localField: 'head_quarter_id',
                    foreignField: 'head_quarter_id',
                    as: 'headDetails',
                },
            }, {
                $unwind: "$headDetails"
            }, { 
                $match : columnAndValue
            }, { 
                $sort : {created_at:-1}
            }, {
                $project: {
                    _id: 0,
                    branch_id: 1
                }
            }];
            let count = await query.joinWithAnd(dbConstants.dbSchema.branches, joinArr);

            joinArr = [{
                $lookup: {
                    from: 'head_quarters',
                    localField: 'head_quarter_id',
                    foreignField: 'head_quarter_id',
                    as: 'headDetails',
                },
            }, {
                $unwind: "$headDetails"
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
                    branch_id: 1,
                    branch_name: 1,
                    registration_id: 1,
                    branch_contact_no: 1,
                    branch_contact_email: 1,
                    head_quarter: "$headDetails.name",
                }
            }];
            let data = await query.joinWithAnd(dbConstants.dbSchema.branches, joinArr);
            data = JSON.parse(JSON.stringify(data))
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
            requestParam.registration_id = await generateRegId();
            requestParam.password = await passwordHandler.encrypt(requestParam.password.toString());
            await query.insertSingle(dbConstants.dbSchema.branches, requestParam);
            resolve({});
            return;
        } catch (error) {
            console.log(error)
            reject(error)
            return
        }
    })
};

const generateRegId = async() => {
    return new Promise(async(resolve, reject) => {
        try {
            let registration_id = await idGenerator.generateString(6, true, false, false); 
            let response = await query.selectWithAndOne(dbConstants.dbSchema.branches, {registration_id}, { _id: 0}, { created_at: 1 });
            if(response){
                resolve(generateRegId());
                return;
            }else{
                resolve(registration_id);
                return;
            }
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
            await query.updateSingle(dbConstants.dbSchema.branches, requestParam, {branch_id: requestParam.branch_id});
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
                await query.removeMultiple(dbConstants.dbSchema.branches, { branch_id: { $in: requestParam['ids']}});
            }
            else{
                await query.updateMultiple(dbConstants.dbSchema.branches, {status: requestParam.type}, {branch_id: { $in: requestParam['ids']}});
            }
            resolve({});
            return;
        } catch (error) {
            reject(error)
            return
        }
    })
};

const signin = async(requestParam, req) => {
    return new Promise(async(resolve, reject) => {
        try {
            let response = await query.selectWithAndOne(dbConstants.dbSchema.branches, {registration_id:requestParam.registration_id}, { _id:0, branch_id:1, password:1} );
            if(!response){
                reject(errors(labels.LBL_REG_ID_FOUND[config.default_language], responseCodes.ResourceNotFound));
                return;
            }
            response = JSON.parse(JSON.stringify(response))
            let encryptPassword = await passwordHandler.encrypt(requestParam.password.toString());
            if(encryptPassword != response.password){
                reject(errors(labels.LBL_INVALID_PWD[config.default_language], responseCodes.InvalidOTP));
                return;
            }
            resolve(profile({branch_id: response.branch_id, time_zone: requestParam.time_zone}));
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
            let response = await query.selectWithAndOne(dbConstants.dbSchema.branches, {branch_id:requestParam.branch_id}, { _id:0, created_at: 0, __v:0, updated_at:0, password:0} );
            if(!response){
                reject(errors(labels.LBL_REG_ID_FOUND[config.default_language], responseCodes.ResourceNotFound));
                return;
            }
            response = JSON.parse(JSON.stringify(response))
            resolve(await encryptDecryptHandler.encrypt(response));
            return;
        } catch (error) {
            console.log(error)
            reject(error)
            return
        }
    })
};

const getAccount = async(requestParam, req) => {
    return new Promise(async(resolve, reject) => {
        try {
            let columnAndValue = {}
            if(requestParam.text && requestParam.text !=''){
                columnAndValue['$or'] = [{
                    branch_id: new RegExp(requestParam.text, 'i')
                }, {
                    branch_name: new RegExp(requestParam.text, 'i')
                }, {
                    "headDetails.name": new RegExp(requestParam.text, 'i')
                }, {
                    registration_id: new RegExp(requestParam.text, 'i')
                }];
            }
            let page = requestParam.page ? requestParam.page : 0 ;
            let sizePerPage = requestParam.sizePerPage ? requestParam.sizePerPage : 10 ;
            let skip = page * sizePerPage;
            let obj = {};

            let joinArr = [{
                $lookup: {
                    from: 'head_quarters',
                    localField: 'head_quarter_id',
                    foreignField: 'head_quarter_id',
                    as: 'headDetails',
                },
            }, {
                $unwind: "$headDetails"
            }, { 
                $match : columnAndValue
            }, { 
                $sort : {created_at:-1}
            }, {
                $project: {
                    _id: 0,
                    branch_id: 1
                }
            }];
            let count = await query.joinWithAnd(dbConstants.dbSchema.branches, joinArr);

            joinArr = [{
                $lookup: {
                    from: 'head_quarters',
                    localField: 'head_quarter_id',
                    foreignField: 'head_quarter_id',
                    as: 'headDetails',
                },
            }, {
                $unwind: "$headDetails"
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
                    branch_id: 1,
                    branch_name: 1,
                    registration_id: 1,
                    total_balance: 1,
                    head_quarter: "$headDetails.name",
                }
            }];
            let data = await query.joinWithAnd(dbConstants.dbSchema.branches, joinArr);
            data = JSON.parse(JSON.stringify(data))
            _.each(data, (elem) => {
                elem.total_balance = elem.total_balance+' TZS'
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

const updateBalance = async(requestParam) => {
    return new Promise(async(resolve, reject) => {
        try {
            await query.updateSingle(dbConstants.dbSchema.branches, {$inc:{total_balance: parseFloat(requestParam.total_balance)}}, {branch_id: requestParam.branch_id});
            requestParam.type = 'add'
            requestParam.amount = requestParam.total_balance
            requestParam.by_whom = 'admin'
            requestParam.by_whom_id = requestParam.user_id
            await query.insertSingle(dbConstants.dbSchema.branch_activities, requestParam);
            resolve({});
            return;
        } catch (error) {
            reject(error)
            return
        }
    })
};

const getRiderDetails = async(requestParam) => {
    return new Promise(async(resolve, reject) => {
        try {
            let response = await query.selectWithAndOne(dbConstants.dbSchema.branches, {branch_id:requestParam.branch_id}, { _id:0, branch_id:1} );
            if(!response){
                reject(errors(labels.LBL_REG_ID_FOUND[config.default_language], responseCodes.ResourceNotFound));
                return;
            }
            let rider = await query.selectWithAndOne(dbConstants.dbSchema.riders, {rider_id:requestParam.rider_id}, { _id:0, rider_id:1, name:1, mobile:1, total_balance:1, email:1, profile_photo:1} );
            if(!rider){
                reject(errors(labels.LBL_INVALID_QR_CODE_VALUE[config.default_language], responseCodes.Conflict));
                return;
            }
            rider.profile_photo = rider.profile_photo != '' ? await imgHandler.getImage({bucket: config.aws.bucketName, key:`emzigo/riders/${rider.profile_photo}`}) : ''
            resolve(await encryptDecryptHandler.encrypt(rider));
            return;
        } catch (error) {
            reject(error)
            return
        }
    })
};

const submitAmount = async(requestParam) => {
    return new Promise(async(resolve, reject) => {
        try {
            let response = await query.selectWithAndOne(dbConstants.dbSchema.branches, {branch_id:requestParam.branch_id}, { _id:0, branch_id:1, total_balance:1} );
            if(!response){
                reject(errors(labels.LBL_REG_ID_FOUND[config.default_language], responseCodes.ResourceNotFound));
                return;
            }
            let rider = await query.selectWithAndOne(dbConstants.dbSchema.riders, {rider_id:requestParam.rider_id}, { _id:0, rider_id:1, total_balance:1} );
            if(!rider){
                reject(errors(labels.LBL_USER_NOT_FOUND[config.default_language], responseCodes.Conflict));
                return;
            }
            if(parseFloat(requestParam.amount) > parseFloat(rider.total_balance)){
                reject(errors(labels.LBL_AMOUNT_NOT_MORE_THEN_RIDER_BALANCE[config.default_language], responseCodes.NotActive));
                return;
            }
            if(parseFloat(requestParam.amount) > parseFloat(response.total_balance)){
                reject(errors(labels.LBL_AMOUNT_NOT_MORE_THEN_BRANCH_BALANCE[config.default_language], responseCodes.NotActive));
                return;
            }
            await query.updateSingle(dbConstants.dbSchema.branches, {$inc:{total_balance: -parseFloat(requestParam.amount)}}, {branch_id: requestParam.branch_id});
            await query.updateSingle(dbConstants.dbSchema.riders, {$inc:{total_balance: -parseFloat(requestParam.amount)}}, {rider_id: requestParam.rider_id});
            let obj = {
                branch_id: requestParam.branch_id,
                rider_id: requestParam.rider_id,
                type:'deduct',
                amount: requestParam.amount,
                by_whom:'You'
            }
            await query.insertSingle(dbConstants.dbSchema.branch_activities, obj);
            await query.insertSingle(dbConstants.dbSchema.rider_activities, obj);
            resolve(await encryptDecryptHandler.encrypt({}));
            return;
        } catch (error) {
            reject(error)
            return
        }
    })
};

const latestTransaction = async(requestParam) => {
    return new Promise(async(resolve, reject) => {
        try {
            let skip = 0
            let limit = 3
            let response = await query.selectWithAndOne(dbConstants.dbSchema.branches, {branch_id:requestParam.branch_id}, { _id:0, branch_id:1, total_balance:1} );
            if(!response){
                reject(errors(labels.LBL_REG_ID_FOUND[config.default_language], responseCodes.ResourceNotFound));
                return;
            }
            let matchColumn = {type:'deduct', branch_id: requestParam.branch_id}
            let lists = await query.selectWithAndFilter(dbConstants.dbSchema.branch_activities, matchColumn, { _id:0, activity_id: 1, rider_id:1, amount:1, transaction_code:1, created_at:1}, {
                created_at: -1,
            }, {
                skip,
                limit
            });
            lists = JSON.parse(JSON.stringify(lists))
            await Promise.all(lists.map(async (elem) => {
                elem.rider_name = ''
                elem.rider_photo = ''
                let response = await query.selectWithAndOne(dbConstants.dbSchema.riders, {rider_id:elem.rider_id}, { _id:0, name:1, profile_photo:1} );
                if(rider){
                    rider.profile_photo = rider.profile_photo != '' ? await imgHandler.getImage({bucket: config.aws.bucketName, key:`emzigo/riders/${rider.profile_photo}`}) : ''
                    elem.rider_name = rider.name
                    elem.rider_photo = rider.profile_photo
                }
                elem.created_at = timeZone(new Date(elem.created_at)).tz(requestParam.time_zone).format('lll')
            }))
            resolve(await encryptDecryptHandler.encrypt(lists));
            return;
        } catch (error) {
            reject(error)
            return
        }
    })
};

const history = async(requestParam) => {
    return new Promise(async(resolve, reject) => {
        try {
            let page = (requestParam.page ? requestParam.page : 1);
            let limit = 10;
            page -= 1;
            let skip = page * limit;

            let response = await query.selectWithAndOne(dbConstants.dbSchema.branches, {branch_id:requestParam.branch_id}, { _id:0, branch_id:1, total_balance:1} );
            if(!response){
                reject(errors(labels.LBL_REG_ID_FOUND[config.default_language], responseCodes.ResourceNotFound));
                return;
            }
            let matchColumn = {branch_id: requestParam.branch_id}
            let lists = await query.selectWithAndFilter(dbConstants.dbSchema.branch_activities, matchColumn, { _id:0, activity_id: 1, rider_id:1, amount:1, transaction_code:1, created_at:1, type:1}, {
                created_at: -1,
            }, {
                skip,
                limit
            });
            lists = JSON.parse(JSON.stringify(lists))
            await Promise.all(lists.map(async (elem) => {
                elem.rider_name = ''
                elem.rider_photo = ''
                let response = await query.selectWithAndOne(dbConstants.dbSchema.riders, {rider_id:elem.rider_id}, { _id:0, name:1, profile_photo:1} );
                if(rider){
                    rider.profile_photo = rider.profile_photo != '' ? await imgHandler.getImage({bucket: config.aws.bucketName, key:`emzigo/riders/${rider.profile_photo}`}) : ''
                    elem.rider_name = rider.name
                    elem.rider_photo = rider.profile_photo
                }
                elem.created_at = timeZone(new Date(elem.created_at)).tz(requestParam.time_zone).format('lll')
            }))
            resolve(await encryptDecryptHandler.encrypt(lists));
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
    signin,
    profile,
    getAccount,
    updateBalance,
    getRiderDetails,
    submitAmount,
    latestTransaction,
    history
};