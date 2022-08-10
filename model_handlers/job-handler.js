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
const imgHandler = require('./../model_handlers/image-handler');
const encryptDecryptHandler = require('./../model_handlers/encrypt-decrypt-handler');
const request = require('request');
const timeZone = require('moment-timezone');
const FCM = require('fcm-push');
let fcm = new FCM(config.push_key);

const get = async(requestParam) => {
    return new Promise(async(resolve, reject) => {
        try {
            let columnValue = {}
            if(requestParam.job_id){
                columnValue.job_id = requestParam.job_id
            }
            let response = await query.selectWithAndOne(dbConstants.dbSchema.jobs, columnValue, { _id: 0}, { created_at: 1 });
            response.item_image = response.item_image != '' ? await imgHandler.getImage({bucket: config.aws.bucketName, key:`emzigo/customers/${response.item_image}`}) : ''
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
            if(requestParam.user_id){
                columnAndValue.user_id = requestParam.user_id
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
                    transaction_id: 1,
                    payment_type: 1,
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

const details = async(requestParam) => {
    return new Promise(async(resolve, reject) => {
        try {
            let columnAndValue = {job_id: requestParam.job_id}
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
                $unwind: "$proDetails"
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
                    job_id: 1,
                    pickup_address: 1,
                    pickup_latitude: 1,
                    pickup_longitude: 1,
                    delivery_address: 1,
                    delivery_latitude: 1,
                    delivery_longitude: 1,
                    delivery_option: "$delDetails.name",
                    created_at:1,
                    accepted_at:1,
                    pickedup_at:1,
                    delivered_at:1,
                    customer:{
                        name:"$cusDetails.name",
                        email:"$cusDetails.email",
                        mobile: { $concat: [ "$cusDetails.mobile_country_code", " ", "$cusDetails.mobile" ] }
                    },
                    provider:{
                        name:"$proDetails.name",
                        email:"$proDetails.email",
                        mobile: { $concat: [ "$proDetails.mobile_country_code", " ", "$proDetails.mobile" ] }
                    },
                    formatted_distance:1,
                    formatted_duration:1,
                    payment_type:1,
                    total:1,
                    amount_pay:1,
                    discount:1,
                    signature_proof_image:1,
                    delivery_recipient_name:1,
                    specified_recipient:1,
                    item_name:1,
                    item_desc:1,
                    item_image:1,
                }
            }];
            let data = await query.joinWithAnd(dbConstants.dbSchema.jobs, joinArr);
            data = JSON.parse(JSON.stringify(data))
            if(data.length == 0){
                resolve({customer:{}, provider:{}});
                return
            }
            let settings = await query.selectWithAndOne(dbConstants.dbSchema.settings, {}, { _id: 0, currency:1}, { created_at: 1 });
            let currency = settings ? settings.currency : 'TZS'

            await Promise.all(data.map(async (elem) => {
                elem.created_at = timeZone(new Date(elem.created_at)).tz(requestParam.time_zone).format('lll')
                elem.accepted_at = elem.accepted_at ? timeZone(new Date(elem.accepted_at)).tz(requestParam.time_zone).format('lll') : ''
                elem.pickedup_at = elem.pickedup_at ? timeZone(new Date(elem.pickedup_at)).tz(requestParam.time_zone).format('lll'): ''
                elem.delivered_at = elem.delivered_at ? timeZone(new Date(elem.delivered_at)).tz(requestParam.time_zone).format('lll') : ''

                elem.total = elem.total +' '+ currency
                elem.discount = elem.discount +' '+ currency
                elem.amount_pay = elem.amount_pay +' '+ currency

                elem.signature_proof_image = elem.signature_proof_image != '' ? await imgHandler.getImage({bucket: config.aws.bucketName, key:`emzigo/providers/${elem.signature_proof_image}`}) : ''
                elem.item_image = elem.item_image != '' ? await imgHandler.getImage({bucket: config.aws.bucketName, key:`emzigo/customers/${elem.item_image}`}) : ''
            }))
            resolve(data[0]);
            return;
        } catch (error) {
            console.log(error)
            reject(error)
            return
        }
    })
};

const createJobBackend = async(requestParam, req) => {
    return new Promise(async(resolve, reject) => {
        try {
            let price = await encryptDecryptHandler.decryptJson(await customerHandler.checkPrice(requestParam))
            requestParam = {...requestParam, ...price}
            requestParam.amount_pay = requestParam.total
            if(req.files){
                if(req.files.item_image){
                    requestParam.item_image = await imgHandler.uploadImage(req.files.item_image, config.aws.s3.customerBucket)
                }
            }
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

const updateJobBackend = async(requestParam, req) => {
    return new Promise(async(resolve, reject) => {
        try {
            let price = await encryptDecryptHandler.decryptJson(await customerHandler.checkPrice(requestParam))
            requestParam = {...requestParam, ...price}
            requestParam.amount_pay = requestParam.total
            if(requestParam.change_logo){
                if(req.files){
                    if(req.files.item_image){
                        requestParam.item_image = await imgHandler.uploadImage(req.files.item_image, config.aws.s3.customerBucket)
                    }
                }
            }
            else{
                delete requestParam.item_image
            }
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
            else{
                await query.updateMultiple(dbConstants.dbSchema.jobs, {status: requestParam.type}, {job_id: { $in: requestParam['ids']}});
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

const assignProvider = async(requestParam) => {
    return new Promise(async(resolve, reject) => {
        try {
            let response = await query.selectWithAndOne(dbConstants.dbSchema.jobs, {job_id:requestParam.ids[0]}, { _id:0, customer_id: 1, job_id:1} );
            if(response){
                await query.updateMultiple(dbConstants.dbSchema.jobs, {status: 'accepted', accepted_at:new Date(), provider_id: requestParam.provider_id}, {job_id: requestParam.ids[0]});
                sendNotificationProvider({provider_id: requestParam.provider_id})
                sendNotificationCustomer({customer_id: response.customer_id, title:'Job Accepted', code:'ACCEPT_JOB'})
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

const sendNotificationProvider = async(requestParam) => {
    return new Promise(async(resolve, reject) => {
        try {
            let response = await query.selectWithAndOne(dbConstants.dbSchema.providers, {provider_id:requestParam.provider_id}, { _id:0, provider_id: 1, device_token:1} );
            let template = await query.selectWithAndOne(dbConstants.dbSchema.push_templates, {code:'PROVIDER_NEW_ASSIGN'}, { _id:0, description:1} );
            if(response && template){
                let val = template.description
                let message = {
                    to: response.device_token,
                    collapse_key: 'your_collapse_key',
                    content_available: true,
                    mutable_content: true,
                    priority: "high",
                    data: {
                        type: 'New Job Assign',
                        title: 'New Job',
                    },
                    notification: {
                        title: 'New Job',
                        body: val,
                        sound: 'default'
                    }
                };
                fcm.send(message, function(err, response) {
                });
            }
            return false
        } catch (error) {
            console.log(error)
            reject(error)
            return
        }
    })
};

const sendNotificationCustomer = async(requestParam) => {
    return new Promise(async(resolve, reject) => {
        try {
            let response = await query.selectWithAndOne(dbConstants.dbSchema.customers, {customer_id:requestParam.customer_id}, { _id:0, customer_id: 1, device_token:1} );
            let template = await query.selectWithAndOne(dbConstants.dbSchema.push_templates, {code:requestParam.code}, { _id:0, description:1} );
            if(response && template){
                let val = template.description
                let message = {
                    to: response.device_token,
                    collapse_key: 'your_collapse_key',
                    content_available: true,
                    mutable_content: true,
                    priority: "high",
                    data: {
                        type: requestParam.code,
                        title: requestParam.title,
                    },
                    notification: {
                        title: requestParam.title,
                        body: val,
                        sound: 'default'
                    }
                };
                fcm.send(message, function(err, response) {
                });
            }
            if(requestParam.code == 'PICKEDUP_JOB'){
                // let msg = 'Your delivery job pin is '+requestParam.otp+'. Do not share it with anyone. Emzigo'
                // let url = 'https://gw.selcommobile.com:8443/bin/send.json?USERNAME=gospoapi&PASSWORD=gospoapi&DESTADDR='+response.mobile+'&MESSAGE='+msg
                // request(url, function (error, response, body) {
                //     console.error('error:', error);
                //     console.log('body:', body);
                // });
            }
            return false
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
    details,
    createJobBackend,
    updateJobBackend,
    action,
    assignProvider,
    getCouponReports,
    sendNotificationCustomer,
    sendNotificationProvider
};