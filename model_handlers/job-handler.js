'use strict';

const config = require('./../config');
const errors = require('./../utils/dz-errors');
const dbConstants = require('./../constants/db-constants');
const query = require('./../utils/query-creator');
const job = require('./../models/job');
const _ = require('underscore');
const labels = require('./../utils/labels.json');
const responseCodes = require('./../utils/response-codes');
const customerHandler = require('./../model_handlers/customer-handler');
const encryptDecryptHandler = require('./../model_handlers/encrypt-decrypt-handler');
const timeZone = require('moment-timezone');

const get = async(requestParam) => {
    return new Promise(async(resolve, reject) => {
        try {
            let columnValue = {}
            if(requestParam.job_id){
                columnValue.job_id = requestParam.job_id
            }
            let response = await query.selectWithAndOne(dbConstants.dbSchema.jobs, columnValue, { _id: 0}, { created_at: 1 });
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
            if(requestParam.status){
                columnAndValue.status = requestParam.status
            }
            if(requestParam.text && requestParam.text !=''){
                columnAndValue['$or'] = [{
                    job_id: new RegExp(requestParam.text, 'i')
                }, {
                    "cusDetails.name": new RegExp(requestParam.text, 'i')
                }, {
                    'vehDetails.name': new RegExp(requestParam.text, 'i')
                }, {
                    'delDetails.name': new RegExp(requestParam.text, 'i')
                }, {
                    'item_name': new RegExp(requestParam.text, 'i')
                }, {
                    'item_desc': new RegExp(requestParam.text, 'i')
                }, {
                    'pickup_address': new RegExp(requestParam.text, 'i')
                }, {
                    'delivery_address': new RegExp(requestParam.text, 'i')
                }];
            }
            let page = requestParam.page ? requestParam.page : 0 ;
            let sizePerPage = requestParam.sizePerPage ? requestParam.sizePerPage : 10 ;
            let skip = page * sizePerPage;
            let obj = {};

            let joinArr = [{
                $lookup: {
                    from: 'customers',
                    localField: 'customer_id',
                    foreignField: 'customer_id',
                    as: 'cusDetails',
                },
            }, {
                $unwind: "$cusDetails"
            }, {
                $lookup: {
                    from: 'providers',
                    localField: 'provider_id',
                    foreignField: 'provider_id',
                    as: 'proDetails',
                },
            }, {
                "$unwind": {
                    "path": "$proDetails",
                    "preserveNullAndEmptyArrays": true
                }
            }, {
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
                $project: {
                    _id: 0,
                    jbs_id: 1,
                }
            }];
            let count = await query.joinWithAnd(dbConstants.dbSchema.jobs, joinArr);

            joinArr = [{
                $lookup: {
                    from: 'customers',
                    localField: 'customer_id',
                    foreignField: 'customer_id',
                    as: 'cusDetails',
                },
            }, {
                $unwind: "$cusDetails"
            }, {
                $lookup: {
                    from: 'providers',
                    localField: 'provider_id',
                    foreignField: 'provider_id',
                    as: 'proDetails',
                },
            }, {
                "$unwind": {
                    "path": "$proDetails",
                    "preserveNullAndEmptyArrays": true
                }
            }, {
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
                    job_id: 1,
                    total: 1,
                    discount: 1,
                    amount_pay: 1,
                    created_at: 1,
                    delivered_at: 1,
                    item_name: 1,
                    item_desc: 1,
                    pickup_address: 1,
                    delivery_address: 1,
                    customer: "$cusDetails.name",
                    provider: "$proDetails",
                    vehicle: "$vehDetails.name",
                    delivery_option: "$delDetails.name",
                }
            }];
            let data = await query.joinWithAnd(dbConstants.dbSchema.jobs, joinArr);
            data = JSON.parse(JSON.stringify(data))

            let settings = await query.selectWithAndOne(dbConstants.dbSchema.settings, {}, { _id: 0, currency:1}, { created_at: 1 });
            let currency = settings ? settings.currency : 'TZS'

            _.each(data, (elem) => {
                elem.created_at = timeZone(new Date(elem.created_at)).tz(requestParam.time_zone).format('lll')
                elem.delivered_at = elem.delivered_at ? timeZone(new Date(elem.delivered_at)).tz(requestParam.time_zone).format('lll') : ''
                elem.total = elem.total +' '+ currency
                elem.discount = elem.discount +' '+ currency
                elem.amount_pay = elem.amount_pay +' '+ currency
                if(elem.provider){
                    elem.provider = elem.provider.name
                }
                else{
                    elem.provider = ''
                }
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

const createJobBackend = async(requestParam) => {
    return new Promise(async(resolve, reject) => {
        try {
            let price = await encryptDecryptHandler.decryptJson(await customerHandler.checkPrice(requestParam))
            requestParam = {...requestParam, ...price}
            requestParam.amount_pay = requestParam.total
            let job = await customerHandler.createJob(requestParam)
            resolve({});
            return;
        } catch (error) {
            console.log(error)
            reject(error)
            return
        }
    })
};

const updateJobBackend = async(requestParam) => {
    return new Promise(async(resolve, reject) => {
        try {
            let price = await encryptDecryptHandler.decryptJson(await customerHandler.checkPrice(requestParam))
            requestParam = {...requestParam, ...price}
            requestParam.amount_pay = requestParam.total
            let job = await customerHandler.updateJob(requestParam)
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
            if(requestParam.type == 'delete'){
                await query.removeMultiple(dbConstants.dbSchema.jobs, { job_id: { $in: requestParam['ids']}});
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

const getCouponReports = async(requestParam) => {
    return new Promise(async(resolve, reject) => {
        try {
            let joinArr = [{
                $lookup: {
                    from: 'jobs',
                    localField: 'coupon_id',
                    foreignField: 'coupon_id',
                    as: 'jobDetails'
                }
            },  { 
                $match : {'jobDetails.status':'delivered', status:'active'}
            }, { 
                $sort : {created_at:-1}
            }, {
                $project: {
                    _id: 0,
                    coupon_id: "$coupon_id",
                    coupon_code: "$coupon_code",
                    created_at: "$created_at",
                    jobs:"$jobDetails",
                }
            }];
            let data = await query.joinWithAnd(dbConstants.dbSchema.coupons, joinArr);
            data = JSON.parse(JSON.stringify(data))

            let settings = await query.selectWithAndOne(dbConstants.dbSchema.settings, {}, { _id: 0, currency:1}, { created_at: 1 });
            let currency = settings ? settings.currency : 'TZS'

            let arr = []
            await Promise.all(data.map(async (elem) => {
                if(elem.jobs.length > 0){
                    _.each(elem.jobs, (itm) => {
                        arr.push({
                            coupon_id: elem.coupon_id,
                            coupon_code: elem.coupon_code,
                            created_at: elem.created_at,
                            job_id: itm.job_id,
                            total: itm.total+' '+ currency,
                            discount: itm.discount+' '+ currency,
                            amount_pay: itm.amount_pay+' '+ currency,
                        })
                    })
                }
            }))
            resolve(arr);
            return;
        } catch (error) {
            console.log(error)
            reject(error)
            return
        }
    })
};

module.exports = {
    get,
    getSort,
    createJobBackend,
    updateJobBackend,
    action,
    getCouponReports
};