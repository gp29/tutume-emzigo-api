'use strict';

const config = require('./../../config');
const errors = require('./../../utils/dz-errors');
const dbConstants = require('./../../constants/db-constants');
const query = require('./../../utils/query-creator');
const installment = require('./../../models/installment');
const _ = require('underscore');
const labels = require('./../../utils/labels.json');
const responseCodes = require('./../../utils/response-codes');
const timeZone = require('moment-timezone');
const moment = require('moment');
const LD = require('lodash');
const async = require('async');
const request = require('request');

const getSort = async(requestParam) => {
    return new Promise(async(resolve, reject) => {
        try {
            let columnAndValue = {}
            let page = requestParam.page ? requestParam.page : 0 ;
            let sizePerPage = requestParam.sizePerPage ? requestParam.sizePerPage : 10 ;
            let skip = page * sizePerPage;
            let obj = {};

            let joinArr = [{ 
                $match : columnAndValue
            }, { 
                $sort : {created_at:-1}
            }, {
                $project: {
                    _id: 0,
                    product_id: "$product_id"
                }
            }];
            let count = await query.joinWithAnd(dbConstants.dbSchema.installments, joinArr);

            joinArr = [{ 
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
                    installment_id:1,
                    rider_id:1,
                    product_id:1,
                    total_amount:1,
                    no_of_installment:1,
                }
            }];
            let data = await query.joinWithAnd(dbConstants.dbSchema.installments, joinArr);
            data = JSON.parse(JSON.stringify(data))
            await Promise.all(data.map(async (elem) => {
                elem.total_amount = elem.total_amount+' TZS'

                let rider = await query.selectWithAndOne(dbConstants.dbSchema.riders, {rider_id: elem.rider_id}, { _id: 0, name:1}, { created_at: 1 });
                elem.rider_name = rider ? rider.name : ''

                let product = await query.selectWithAndOne(dbConstants.dbSchema.products, {product_id: elem.product_id}, { _id: 0, name:1}, { created_at: 1 });
                elem.product_name = product ? product.name : ''
            }));
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
            await query.insertSingle(dbConstants.dbSchema.installments, requestParam);
            let product = await query.selectWithAndOne(dbConstants.dbSchema.products, {product_id: requestParam.product_id}, { _id: 0, product:1, name:1}, { created_at: -1 });
            let rider = await query.selectWithAndOne(dbConstants.dbSchema.riders, {rider_id: requestParam.rider_id}, { _id: 0, rider_id:1, name:1, mobile:1}, { created_at: -1 });
            if(rider && product){
                let msg = "Hello "+rider.name+", your first installment of "+product.name+" has been created."
                let url = "http://mshastra.com/sendurl.aspx?user=PANDALTD&pwd=uu641py9&senderid=Panda&CountryCode=255&mobileno="+rider.mobile+"&msgtext="+msg
                request(url, function (error, response, body) {
                    console.error('error:', error);
                    console.log('body:', body);
                });
            }
            resolve({});
            return;
        } catch (error) {
            console.log(error)
            reject(error)
            return
        }
    })
};

const action = async(requestParam) => {
    return new Promise(async(resolve, reject) => {
        try {
            if (requestParam['type']== "delete") {
                await query.removeMultiple(dbConstants.dbSchema.installments, { product_id: { $in: requestParam['ids']}});
            }
            resolve({});
            return;
        } catch (error) {
            reject(error)
            return
        }
    })
};

const getInstallment = async(requestParam) => {
    return new Promise(async(resolve, reject) => {
        try {
            let obj = {total_amount:0, no_of_installment: 0, installments:[]}
            let response = await query.selectWithAndOne(dbConstants.dbSchema.products, requestParam, { _id: 0, product_id:1, no_of_installment:1, total_amount:1}, { created_at: -1 });
            if(response){
                obj.total_amount = parseFloat(response.total_amount)
                obj.no_of_installment = parseFloat(response.no_of_installment)
                let emiPrice = parseFloat(parseFloat(parseFloat(response.total_amount) / obj.no_of_installment).toFixed(2))
                let arr = [{
                    installment_no:1,
                    amount: emiPrice,
                    paid_date: moment(new Date()).format('YYYY-MM-DD'),
                    due_date: moment(new Date()).format('YYYY-MM-DD'),
                    status: 'paid',
                    reference: 'panda_admin',
                }]
                let cnt = 1
                async.forEachSeries(_.range(obj.no_of_installment - 1), async function(elem, callback) {
                    let addDays = cnt * 30
                    arr.push({
                        installment_no: cnt + 1,
                        amount: emiPrice,
                        paid_date: '',
                        due_date: moment(new Date()).add(addDays, 'days').format('YYYY-MM-DD'),
                        status: 'unpaid',
                        reference: '',
                    })
                    cnt++;
                }, () => {
                    obj.installments = arr
                    resolve(obj);
                    return;
                });
            }
            else{
                resolve(obj);
                return;
            }
        } catch (error) {
            console.log(error)
            reject(error)
            return
        }
    })
};

const getReconciliation = async(requestParam) => {
    return new Promise(async(resolve, reject) => {
        try {
            let columnAndValue = {user_id: requestParam.user_id, status:'unsettled'}

            let page = requestParam.page ? requestParam.page : 0 ;
            let sizePerPage = requestParam.sizePerPage ? requestParam.sizePerPage : 10 ;
            let skip = page * sizePerPage;
            let obj = {};

            let joinArr = [{ 
                $match : columnAndValue
            }, { 
                $sort : {created_at:-1}
            }, {
                $project: {
                    _id: 0,
                    installment_activity_id: "$installment_activity_id"
                }
            }];
            let count = await query.joinWithAnd(dbConstants.dbSchema.installment_histories, joinArr);

            joinArr = [{ 
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
                    installment_activity_id:1,
                    user_id:1,
                    rider_id:1,
                    product_id:1,
                    installment_no:1,
                    amount:1,
                    need_to_pay_amount:1,
                    date:1,
                }
            }];
            let data = await query.joinWithAnd(dbConstants.dbSchema.installment_histories, joinArr);
            data = JSON.parse(JSON.stringify(data))
            await Promise.all(data.map(async (elem) => {
                elem.amount = elem.amount+' TZS'
                elem.need_to_pay_amount = elem.need_to_pay_amount+' TZS'

                let user = await query.selectWithAndOne(dbConstants.dbSchema.users, {user_id: elem.user_id}, { _id: 0, name:1}, { created_at: 1 });
                elem.user_name = user ? user.name : ''

                let rider = await query.selectWithAndOne(dbConstants.dbSchema.riders, {rider_id: elem.rider_id}, { _id: 0, name:1}, { created_at: 1 });
                elem.rider_name = rider ? rider.name : ''

                let product = await query.selectWithAndOne(dbConstants.dbSchema.products, {product_id: elem.product_id}, { _id: 0, name:1}, { created_at: 1 });
                elem.product_name = product ? product.name : ''
            }));
            obj.data = data;
            obj.count = count.length;

            let total = await query.selectWithAnd(dbConstants.dbSchema.installment_histories, columnAndValue, { _id: 0, need_to_pay_amount:1}, { created_at: -1 });
            obj.total_amount_to_settle = parseFloat(LD.sumBy(total, 'need_to_pay_amount')).toFixed(2)+' TZS'
            resolve(obj);
            return;
        } catch (error) {
            console.log(error)
            reject(error)
            return
        }
    })
};

const settlementReconciliation = async(requestParam) => {
    return new Promise(async(resolve, reject) => {
        try {
            await query.updateMultiple(dbConstants.dbSchema.installment_histories, {status: 'settled'}, {user_id: { $in: requestParam['user_id']}});
            resolve({});
            return;
        } catch (error) {
            console.log(error)
            reject(error)
            return
        }
    })
};

module.exports = {
    getSort,
    create,
    action,
    getInstallment,
    getReconciliation,
    settlementReconciliation
};