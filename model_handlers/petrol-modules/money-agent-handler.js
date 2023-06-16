'use strict';

const config = require('./../../config');
const errors = require('./../../utils/dz-errors');
const dbConstants = require('./../../constants/db-constants');
const query = require('./../../utils/query-creator');
const _ = require('underscore');
const labels = require('./../../utils/labels.json');
const responseCodes = require('./../../utils/response-codes');
const installmenthistory = require('./../../models/installment-history');
const moment = require('moment');
const timeZone = require('moment-timezone');
const encryptDecryptHandler = require('./../../model_handlers/encrypt-decrypt-handler');
const passwordHandler = require('./../../utils/password-handler');
const LD = require('lodash');
const request = require('request');
const imgHandler = require('./../../model_handlers/image-handler');

const signin = async(requestParam, req) => {
    return new Promise(async(resolve, reject) => {
        try {
            let response = await query.selectWithAndOne(dbConstants.dbSchema.users, {mobile:requestParam.mobile}, { _id:0, user_id:1, name:1, mobile:1, status:1, password:1, email:1} );
            if(!response){
                reject(errors(labels.LBL_MOBILE_FOUND[config.default_language], responseCodes.ResourceNotFound));
                return;
            }
            response = JSON.parse(JSON.stringify(response))
            let encryptPassword = await passwordHandler.encrypt(requestParam.password.toString());
            if(encryptPassword != response.password){
                reject(errors(labels.LBL_INVALID_PWD[config.default_language], responseCodes.InvalidOTP));
                return;
            }
            resolve(profile({user_id: response.user_id, time_zone: requestParam.time_zone}));
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
            let response = await query.selectWithAndOne(dbConstants.dbSchema.users, {user_id:requestParam.user_id}, { _id:0, user_id:1, name:1, email:1, mobile:1, status:1} );
            if(!response){
                reject(errors(labels.LBL_USER_NOT_FOUND[config.default_language], responseCodes.ResourceNotFound));
                return;
            }
            response = JSON.parse(JSON.stringify(response))
            if(response.status == 'inactive'){
                reject(errors(labels.LBL_ACCOUNT_INACTIVE[config.default_language], responseCodes.NotActive));
                return;
            }
            let due = await query.selectWithAnd(dbConstants.dbSchema.installment_histories, {user_id:requestParam.user_id, status:'unsettled'}, { _id:0, user_id:1, need_to_pay_amount:1} );
            let todayEarn = await query.selectWithAnd(dbConstants.dbSchema.installment_histories, {user_id:requestParam.user_id, status:'unsettled', date: moment(new Date()).format('YYYY-MM-DD')}, { _id:0, user_id:1, commission_amount:1} );
            response.user_type = 'money_agent'
            response.user_id = response.user_id
            response.due_amount = LD.sumBy(due, 'need_to_pay_amount')+' TZS'
            response.today_earn_amount = LD.sumBy(todayEarn, 'commission_amount')+' TZS'
            resolve(await encryptDecryptHandler.encrypt(response));
            return;
        } catch (error) {
            console.log(error)
            reject(error)
            return
        }
    })
};

const riderInstallmentDetails = async(requestParam) => {
    return new Promise(async(resolve, reject) => {
        try {
            let response = await query.selectWithAndOne(dbConstants.dbSchema.users, {user_id:requestParam.user_id}, { _id:0, user_id:1, name:1, email:1, mobile:1, status:1} );
            if(!response){
                reject(errors(labels.LBL_USER_NOT_FOUND[config.default_language], responseCodes.ResourceNotFound));
                return;
            }
            let rider = await query.selectWithAndOne(dbConstants.dbSchema.riders, {mobile:requestParam.mobile}, { _id:0, rider_id:1, name:1, mobile:1, profile_photo:1} );
            if(!rider){
                reject(errors(labels.LBL_USER_NOT_FOUND[config.default_language], responseCodes.ResourceNotFound));
                return;
            }
            rider = JSON.parse(JSON.stringify(rider))
            rider.profile_photo = rider.profile_photo != '' ? await imgHandler.getImage({bucket: config.aws.bucketName, key:`emzigo/riders/${rider.profile_photo}`}) : ''
            rider.products = []
            let lists = await query.selectWithAnd(dbConstants.dbSchema.installments, {rider_id:rider.rider_id}, { _id:0, product_id:1, total_amount:1, no_of_installment:1, installments:1, status:1} );
            if(lists.length > 0){
                lists = JSON.parse(JSON.stringify(lists))
                await Promise.all(lists.map(async (elem) => {
                    let product = await query.selectWithAndOne(dbConstants.dbSchema.products, {product_id: elem.product_id}, { _id: 0, name:1}, { created_at: 1 });
                    elem.product_name = product ? product.name : ''
                    let installments = []
                    _.each(elem.installments, (itm) => {
                        if(itm.status == 'unpaid'){
                            installments.push(itm)
                        }
                    })
                    elem.installments = installments
                }))
                rider.products = lists
                resolve(await encryptDecryptHandler.encrypt(rider));
                return;
            }
            else{
                resolve(await encryptDecryptHandler.encrypt(rider));
                return;    
            }
        } catch (error) {
            console.log(error)
            reject(error)
            return
        }
    })
};

const payRiderInstallment = async(requestParam) => {
    return new Promise(async(resolve, reject) => {
        try {
            let settings = await query.selectWithAndOne(dbConstants.dbSchema.settings, {}, { _id:0, money_agent_commission_percentage:1} );
            
            let response = await query.selectWithAndOne(dbConstants.dbSchema.users, {user_id:requestParam.user_id}, { _id:0, user_id:1, name:1, email:1, mobile:1, status:1} );
            if(!response){
                reject(errors(labels.LBL_USER_NOT_FOUND[config.default_language], responseCodes.ResourceNotFound));
                return;
            }
            let rider = await query.selectWithAndOne(dbConstants.dbSchema.riders, {rider_id:requestParam.rider_id}, { _id:0, rider_id:1, name:1, mobile:1} );
            if(!rider){
                reject(errors(labels.LBL_USER_NOT_FOUND[config.default_language], responseCodes.ResourceNotFound));
                return;
            }
            let product = await query.selectWithAndOne(dbConstants.dbSchema.products, {product_id:requestParam.product_id}, { _id:0, product_id:1, name:1} );
            if(!product){
                reject(errors(labels.LBL_USER_NOT_FOUND[config.default_language], responseCodes.ResourceNotFound));
                return;
            }
            requestParam.installment_no = parseFloat(requestParam.installment_no)
            let inst = await query.selectWithAndOne(dbConstants.dbSchema.installments, {rider_id:requestParam.rider_id, product_id: requestParam.product_id}, { _id:0, product_id:1, installments:1} );
            let val = _.where(inst.installments, {installment_no: requestParam.installment_no})
            if(val.length > 0){
                val = val[0]
                requestParam.amount = parseFloat(val.amount)
                requestParam.commission_percentage = settings.money_agent_commission_percentage
                requestParam.commission_amount = parseFloat(parseFloat((requestParam.amount * settings.money_agent_commission_percentage) / 100).toFixed(2))
                requestParam.need_to_pay_amount = parseFloat(parseFloat(requestParam.amount - requestParam.commission_amount).toFixed(2))
                requestParam.date = moment(new Date()).format('YYYY-MM-DD')
                requestParam.status = 'unsettled'
                let res = await query.insertSingle(dbConstants.dbSchema.installment_histories, requestParam);

                // for update status date
                let installments = inst.installments
                _.each(installments, (elem) => {
                    if(elem.installment_no == requestParam.installment_no && elem.status == 'unpaid'){
                        elem.status = 'paid'
                        elem.paid_date = moment(new Date()).format('YYYY-MM-DD')
                        elem.reference = res.installment_activity_id
                    }
                })
                await query.updateSingle(dbConstants.dbSchema.installments, { installments }, {rider_id:requestParam.rider_id, product_id: requestParam.product_id});
                
                // for SMS
                let msg = "Hello "+rider.name+", your "+requestParam.installment_no+" installment of "+product.name+" has been created."
                let url = "http://mshastra.com/sendurl.aspx?user=Tutumeltd&pwd=epp1pjse&senderid=Panda&CountryCode=255&mobileno="+rider.mobile+"&msgtext="+msg
                request(url, function (error, response, body) {
                    console.error('error:', error);
                    console.log('body:', body);
                });
            }
            resolve(await encryptDecryptHandler.encrypt({}));
            return;
        } catch (error) {
            console.log(error)
            reject(error)
            return
        }
    })
};

const recentActivities = async(requestParam) => {
    return new Promise(async(resolve, reject) => {
        try {
            let page = (requestParam.page ? requestParam.page : 1);
            let limit = 20;
            page -= 1;
            let skip = page * limit;

            let response = await query.selectWithAndOne(dbConstants.dbSchema.users, {user_id:requestParam.user_id}, { _id:0, user_id:1, name:1, email:1, mobile:1, status:1} );
            if(!response){
                reject(errors(labels.LBL_USER_NOT_FOUND[config.default_language], responseCodes.ResourceNotFound));
                return;
            }
            let lists = await query.selectWithAndFilter(dbConstants.dbSchema.installment_histories, {user_id: requestParam.user_id}, { _id:0, user_id: 1, rider_id:1, amount:1, created_at:1, status:1}, { created_at: -1 }, {skip, limit});
            lists = JSON.parse(JSON.stringify(lists))
            await Promise.all(lists.map(async (elem) => {
                elem.amount = elem.amount+' TZS'
                elem.created_at = timeZone(new Date(elem.created_at)).tz(requestParam.time_zone).format('lll')
                let rider = await query.selectWithAndOne(dbConstants.dbSchema.riders, {rider_id:elem.rider_id}, { _id:0, name: 1, rider_id:1, profile_photo:1} );
                elem.rider_name = rider ? rider.name : ''
                elem.rider_photo = rider ? (rider.profile_photo != '' ? await imgHandler.getImage({bucket: config.aws.bucketName, key:`emzigo/riders/${rider.profile_photo}`}) : '') : ''
            }))
            resolve(await encryptDecryptHandler.encrypt(lists));
            return;
        } catch (error) {
            console.log(error)
            reject(error)
            return
        }
    })
};

module.exports = {
    signin,
    profile,
    riderInstallmentDetails,
    payRiderInstallment,
    recentActivities
};