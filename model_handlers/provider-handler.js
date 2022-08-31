'use strict';

const config = require('./../config');
const errors = require('./../utils/dz-errors');
const dbConstants = require('./../constants/db-constants');
const query = require('./../utils/query-creator');
const provider = require('./../models/provider');
const _ = require('underscore');
const labels = require('./../utils/labels.json');
const responseCodes = require('./../utils/response-codes');
const timeZone = require('moment-timezone');
const moment = require('moment');
const imgHandler = require('./../model_handlers/image-handler');
const FCM = require('fcm-push');
let fcm = new FCM(config.push_key);
const passwordHandler = require('./../utils/password-handler');
const jobHandler = require('./../model_handlers/job-handler');
const encryptDecryptHandler = require('./../model_handlers/encrypt-decrypt-handler');

const get = async(requestParam) => {
    return new Promise(async(resolve, reject) => {
        try {
            let columnValue = {}
            if(requestParam.provider_id){
                columnValue.provider_id = requestParam.provider_id
            }
            if(requestParam.status){
                columnValue.status = requestParam.status
            }
            let response = await query.selectWithAnd(dbConstants.dbSchema.providers, columnValue, { _id: 0}, { created_at: 1 });
            if(requestParam.provider_id){
                response = response[0]
                response.profile_photo = response.profile_photo != '' ? await imgHandler.getImage({bucket: config.aws.bucketName, key:`emzigo/providers/${response.profile_photo}`}) : ''
                response.id_photo = response.id_photo != '' ? await imgHandler.getImage({bucket: config.aws.bucketName, key:`emzigo/providers/${response.id_photo}`}) : ''
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

const assignList = async(requestParam) => {
    return new Promise(async(resolve, reject) => {
        try {
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
                $match : {status:'active'}
            }, { 
                $sort : {created_at:-1}
            }, {
                $project: {
                    _id: 0,
                    provider_id:1,
                    name:1,
                    vehicle:"$vehDetails.name"
                }
            }];
            let data = await query.joinWithAnd(dbConstants.dbSchema.providers, joinArr);
            resolve(data);
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
                    provider_id: new RegExp(requestParam.text, 'i')
                }, {
                    name: new RegExp(requestParam.text, 'i')
                }, {
                    email: new RegExp(requestParam.text, 'i')
                }, {
                    mobile_country_code: new RegExp(requestParam.text, 'i')
                }, {
                    mobile: new RegExp(requestParam.text, 'i')
                }, {
                    status: new RegExp(requestParam.text, 'i')
                }];
            }
            let page = requestParam.page ? requestParam.page : 0 ;
            let sizePerPage = requestParam.sizePerPage ? requestParam.sizePerPage : 10 ;
            let skip = page * sizePerPage;
            let obj = {};

            let count = await query.countRecord(dbConstants.dbSchema.providers, columnAndValue)
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
                    provider_id:1,
                    name:1,
                    email:1,
                    mobile:{ $concat: [ "$mobile_country_code", " ", "$mobile" ] },
                    status:1,
                    created_at:1,
                    jobs:"0",
                }
            }];
            let data = await query.joinWithAnd(dbConstants.dbSchema.providers, joinArr);
            data = JSON.parse(JSON.stringify(data))
            _.each(data, (elem) => {
                elem.created_at = timeZone(new Date(elem.created_at)).tz(requestParam.time_zone).format('lll')
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

const create = async(requestParam, req) => {
    return new Promise(async(resolve, reject) => {
        try {
            requestParam.email = requestParam.email.trim();
            let regexEmail = new RegExp(['^', requestParam.email, '$'].join(''), 'i');
            let compareColumnAndValues = {
                 $or: [{
                    email: regexEmail
                }, {
                    mobile: requestParam.mobile,
                    mobile_country_code: requestParam.mobile_country_code,
                }]
            };
            let response = await query.selectWithAndOne(dbConstants.dbSchema.providers, compareColumnAndValues, { _id: 0, provider_id:1}, { created_at: 1 });
            if(response){
                reject(errors(labels.LBL_EMAIL_OR_MOBILE_ALREADY_EXISTS[config.default_language], responseCodes.ResourceNotFound));
                return;
            }
            if(req.files){
                if(req.files.profile_photo){
                    requestParam.profile_photo = await imgHandler.uploadImage(req.files.profile_photo, config.aws.s3.providerBucket)
                }
                if(req.files.id_photo){
                    requestParam.id_photo = await imgHandler.uploadImage(req.files.id_photo, config.aws.s3.providerBucket)
                }
            }
            requestParam.password = await passwordHandler.encrypt(requestParam.password.toString())
            await query.insertSingle(dbConstants.dbSchema.providers, requestParam);
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
                        mobile_country_code: requestParam.mobile_country_code,
                    }]
                }, {
                    provider_id: {
                        $ne: requestParam.provider_id
                    }
                }]
            };
            let response = await query.selectWithAndOne(dbConstants.dbSchema.providers, compareColumnAndValues, { _id: 0, provider_id:1}, { created_at: 1 });
            if(response){
                reject(errors(labels.LBL_EMAIL_OR_MOBILE_ALREADY_EXISTS[config.default_language], responseCodes.ResourceNotFound));
                return;
            }
            let customer = await query.selectWithAndOne(dbConstants.dbSchema.providers, {provider_id: requestParam.provider_id}, { _id: 0, profile_photo:1, id_photo:1}, { created_at: 1 });
            if (requestParam.change_logo) {
                const objects = [{
                    Key: `emzigo/providers/${customer.profile_photo}`
                }];
                await imgHandler.deleteImage(objects, config.aws.bucketName)
                requestParam.profile_photo = await imgHandler.uploadImage(req.files.profile_photo, config.aws.s3.providerBucket)
            }
            else{
                delete requestParam.profile_photo
            }

            if (requestParam.change_id_photo) {
                const objects = [{
                    Key: `emzigo/providers/${customer.id_photo}`
                }];
                await imgHandler.deleteImage(objects, config.aws.bucketName)
                requestParam.id_photo = await imgHandler.uploadImage(req.files.id_photo, config.aws.s3.providerBucket)
            }
            else{
                delete requestParam.id_photo
            }
            await query.updateSingle(dbConstants.dbSchema.providers, requestParam, {provider_id: requestParam.provider_id});
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
                let response = await query.selectWithAnd(dbConstants.dbSchema.providers, {provider_id: {$in: requestParam.ids}}, { _id: 0, provider_id:1, profile_photo:1, id_photo:1}, { created_at: 1 });
                let objects = []
                await Promise.all(response.map(async (elem) => {
                    objects.push({
                        Key: `emzigo/providers/${elem.profile_photo}`
                    });
                    objects.push({
                        Key: `emzigo/providers/${elem.id_photo}`
                    });
                }))
                if(objects.length > 0) await imgHandler.deleteImage(objects, config.aws.bucketName)
                await query.removeMultiple(dbConstants.dbSchema.providers, { provider_id: { $in: requestParam['ids']}});
            }
            else{
                await query.updateMultiple(dbConstants.dbSchema.providers, {status: requestParam.type}, {provider_id: { $in: requestParam['ids']}});
            }
            resolve({});
            return;
        } catch (error) {
            reject(error)
            return
        }
    })
};

const sendNotification = async(requestParam) => {
    return new Promise(async(resolve, reject) => {
        try {
            let providers = await query.selectWithAnd(dbConstants.dbSchema.providers, {
                provider_id: {
                    $in: requestParam.ids
                }
            }, {
                _id: 0,
                provider_id: 1,
                device_token: 1
            }, {
                created_at: 1
            });
            sendNotiProvider(providers, requestParam.title)
            resolve({});
            return;
        } catch (error) {
            reject(error)
            return
        }
    })
};

const sendNotiProvider = async(providers, title) => {
    return new Promise(async(resolve, reject) => {
        try {
            await Promise.all(providers.map(async(element) => {
                let message = {
                    to: element.device_token,
                    collapse_key: 'your_collapse_key',
                    content_available: true,
                    mutable_content: true,
                    priority: "high",
                    data: {
                        type: 'promotion',
                        title: 'Tutume',
                    },
                    notification: {
                        title: 'Tutume',
                        body: title,
                        sound: 'default'
                    }
                };
                fcm.send(message, function(err, response) {
                    return false;
                });
            }))
            return false;
        } catch (error) {
            reject(error)
            return
        }
    })
};

const trips = async(requestParam) => {
    return new Promise(async(resolve, reject) => {
        try {
            let joinArr = [{
                $lookup: {
                    from: 'customers',
                    localField: 'customer_id',
                    foreignField: 'customer_id',
                    as: 'cusDetails'
                }
            }, {
                $unwind: "$cusDetails"
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
                    as: 'deliveryOptDetails',
                },
            }, {
                $unwind: "$deliveryOptDetails"
            }, { 
                $match : { driver_id: requestParam.driver_id, status: {$nin: ["delivered", "cancelled"]}}
            }, { 
                $sort : {created_at:-1}
            }, {
                $project: {
                    _id: 0,
                    job_id: "$job_id",
                    customer: "$cusDetails.name",
                    delivery_option: "$deliveryOptDetails.name",
                    vehicle: "$vehDetails.name",
                    pickup_address: "$pickup_address",
                    delivery_address: "$delivery_address",
                    created_at: "$created_at",
                    status: "$status",
                }
            }];
            let data = await query.joinWithAnd(dbConstants.dbSchema.jobs, joinArr);
            data = JSON.parse(JSON.stringify(data))
            resolve(data);
            return;
        } catch (error) {
            console.log(error)
            reject(error)
            return
        }
    })
};

// FOR API

const signup = async(requestParam, req) => {
    return new Promise(async(resolve, reject) => {
        try {
            if(requestParam.name){
                requestParam.name = await encryptDecryptHandler.decryptString(requestParam.name)
            }
            if(requestParam.email){
                requestParam.email = await encryptDecryptHandler.decryptString(requestParam.email)
            }
            if(requestParam.password){
                requestParam.password = await encryptDecryptHandler.decryptString(requestParam.password)
            }
            if(requestParam.mobile_country_code){
                requestParam.mobile_country_code = await encryptDecryptHandler.decryptString(requestParam.mobile_country_code)
            }
            if(requestParam.mobile){
                requestParam.mobile = await encryptDecryptHandler.decryptString(requestParam.mobile)
            }
            if(requestParam.address){
                requestParam.address = await encryptDecryptHandler.decryptString(requestParam.address)
            }
            if(requestParam.vehicle_id){
                requestParam.vehicle_id = await encryptDecryptHandler.decryptString(requestParam.vehicle_id)
            }

            requestParam.email = requestParam.email.trim();
            let regexEmail = new RegExp(['^', requestParam.email, '$'].join(''), 'i');
            let compareColumnAndValues = {
                 $or: [{
                    email: regexEmail
                }, {
                    mobile: requestParam.mobile,
                    mobile_country_code: requestParam.mobile_country_code,
                }]
            };
            let response = await query.selectWithAndOne(dbConstants.dbSchema.providers, compareColumnAndValues, { _id: 0, provider_id:1}, { created_at: 1 });
            if(response){
                reject(errors(labels.LBL_EMAIL_OR_MOBILE_ALREADY_EXISTS[config.default_language], responseCodes.ResourceNotFound));
                return;
            }
            if(req.files){
                if(req.files.profile_photo){
                    requestParam.profile_photo = await imgHandler.uploadImage(req.files.profile_photo, config.aws.s3.providerBucket)
                }
                if(req.files.id_photo){
                    requestParam.id_photo = await imgHandler.uploadImage(req.files.id_photo, config.aws.s3.providerBucket)
                }
            }
            requestParam.password = await passwordHandler.encrypt(requestParam.password.toString())
            let res = await query.insertSingle(dbConstants.dbSchema.providers, requestParam);
            resolve(profile({provider_id: res.provider_id, time_zone: requestParam.time_zone}));
            return;
        } catch (error) {
            console.log(error)
            reject(error)
            return
        }
    })
};

const updateProfile = async(requestParam, req) => {
    return new Promise(async(resolve, reject) => {
        try {
            if(requestParam.email) delete requestParam.email
            if(requestParam.mobile) delete requestParam.mobile
            if(requestParam.mobile_country_code) delete requestParam.mobile_country_code

            if(requestParam.provider_id){
                requestParam.provider_id = await encryptDecryptHandler.decryptString(requestParam.provider_id)
            }
            if(requestParam.name){
                requestParam.name = await encryptDecryptHandler.decryptString(requestParam.name)
            }
            if(requestParam.address){
                requestParam.address = await encryptDecryptHandler.decryptString(requestParam.address)
            }
            if(requestParam.vehicle_id){
                requestParam.vehicle_id = await encryptDecryptHandler.decryptString(requestParam.vehicle_id)
            }

            let response = await query.selectWithAndOne(dbConstants.dbSchema.providers, {provider_id:requestParam.provider_id}, { _id:0, provider_id: 1, profile_photo:1, id_photo:1} );
            if(!response){
                reject(errors(labels.LBL_USER_NOT_FOUND[config.default_language], responseCodes.ResourceNotFound));
                return;
            }
            if(req.files){
                let objects = []
                if(req.files.profile_photo){
                    objects.push({
                        Key: `emzigo/providers/${response.profile_photo}`
                    })
                    requestParam.profile_photo = await imgHandler.uploadImage(req.files.profile_photo, config.aws.s3.providerBucket)
                }
                if(req.files.id_photo){
                    objects.push({
                        Key: `emzigo/providers/${response.id_photo}`
                    })
                    requestParam.id_photo = await imgHandler.uploadImage(req.files.id_photo, config.aws.s3.providerBucket)
                }
                if(objects.length > 0) await imgHandler.deleteImage(objects, config.aws.bucketName)
            }
            await query.updateSingle(dbConstants.dbSchema.providers, requestParam, {provider_id: requestParam.provider_id});
            resolve(profile({provider_id: requestParam.provider_id, time_zone: requestParam.time_zone}));
            return;
        } catch (error) {
            console.log(error)
            reject(error)
            return
        }
    })
};

const signin = async(requestParam, req) => {
    return new Promise(async(resolve, reject) => {
        try {
            let response = await query.selectWithAndOne(dbConstants.dbSchema.providers, {mobile_country_code:requestParam.mobile_country_code, mobile: requestParam.mobile}, { _id:0, provider_id: 1, password:1, name:1, email:1, status:1} );
            if(!response){
                reject(errors(labels.LBL_MOBILE_NOT_FOUND[config.default_language], responseCodes.ResourceNotFound));
                return;
            }
            response = JSON.parse(JSON.stringify(response))
            if(response.status == 'inactive'){
                reject(errors(labels.LBL_ACCOUNT_INACTIVE[config.default_language], responseCodes.NotActive));
                return;
            }
            let encryptPassword = await passwordHandler.encrypt(requestParam.password.toString());
            if(encryptPassword != response.password){
                reject(errors(labels.LBL_INVALID_PWD[config.default_language], responseCodes.InvalidOTP));
                return;
            }
            let updateColumn = {updated_at: new Date()}
            if(requestParam.device_token){
                updateColumn.device_token = requestParam.device_token
            }
            await query.updateSingle(dbConstants.dbSchema.providers, updateColumn, {provider_id: response.provider_id});
            resolve(profile({provider_id: response.provider_id, time_zone: requestParam.time_zone}));
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
            let response = await query.selectWithAndOne(dbConstants.dbSchema.providers, {provider_id:requestParam.provider_id}, { _id:0, provider_id: 1, name:1, email:1, mobile_country_code:1, mobile:1, profile_photo:1, id_photo:1, address:1, vehicle_id:1, status:1, vehicle_number:1} );
            if(!response){
                reject(errors(labels.LBL_USER_NOT_FOUND[config.default_language], responseCodes.ResourceNotFound));
                return;
            }
            response = JSON.parse(JSON.stringify(response))
            if(response.status == 'inactive'){
                reject(errors(labels.LBL_ACCOUNT_INACTIVE[config.default_language], responseCodes.NotActive));
                return;
            }
            response.vehicle_name = ''
            let vehicle = await query.selectWithAndOne(dbConstants.dbSchema.vehicles, {vehicle_id:response.vehicle_id}, { _id:0, name: 1} );
            if(vehicle){
                response.vehicle_name = vehicle.name
            }
            response.profile_photo = response.profile_photo != '' ? await imgHandler.getImage({bucket: config.aws.bucketName, key:`emzigo/providers/${response.profile_photo}`}) : ''
            response.id_photo = response.id_photo != '' ? await imgHandler.getImage({bucket: config.aws.bucketName, key:`emzigo/providers/${response.id_photo}`}) : ''
            resolve(await encryptDecryptHandler.encrypt(response));
            return;
        } catch (error) {
            console.log(error)
            reject(error)
            return
        }
    })
};

const changePassword = async(requestParam) => {
    return new Promise(async(resolve, reject) => {
        try {
            let response = await query.selectWithAndOne(dbConstants.dbSchema.providers, {mobile_country_code:requestParam.mobile_country_code, mobile: requestParam.mobile}, { _id:0, provider_id: 1} );
            if(!response){
                reject(errors(labels.LBL_MOBILE_NOT_FOUND[config.default_language], responseCodes.ResourceNotFound));
                return;
            }
            let password = await passwordHandler.encrypt(requestParam.password.toString());
            await query.updateSingle(dbConstants.dbSchema.providers, {password}, {provider_id: response.provider_id});
            resolve(await encryptDecryptHandler.encrypt({}));
            return;
        } catch (error) {
            reject(error)
            return
        }
    })
};

const logoutDelete = async(requestParam) => {
    return new Promise(async(resolve, reject) => {
        try {
            if(requestParam.type == 'logout'){
                await query.updateSingle(dbConstants.dbSchema.providers, {device_token:''}, { provider_id: requestParam.provider_id });
            }
            if(requestParam.type == 'delete'){
                let user = await query.selectWithAndOne(dbConstants.dbSchema.providers, {provider_id: requestParam.provider_id}, { _id:0, profile_photo: 1, id_photo:1});
                let objects = []
                if(user){
                    if(user.profile_photo != ''){
                        objects.push({
                            Key: `emzigo/providers/${user.profile_photo}`
                        })
                    }
                    if(user.id_photo != ''){
                        objects.push({
                            Key: `emzigo/providers/${user.id_photo}`
                        })
                    }
                    if(objects.length > 0){
                        await imgHandler.deleteImage(objects, config.aws.bucketName)
                    }
                }
                await query.removeMultiple(dbConstants.dbSchema.providers, {provider_id: requestParam.provider_id})
            }
            resolve(await encryptDecryptHandler.encrypt({}))
            return;
        } catch (error) {
            console.log(error)
            reject(error)
            return
        }
    })
};

const deliveriesForYou = async(requestParam) => {
    return new Promise(async(resolve, reject) => {
        try {
            let response = await query.selectWithAndOne(dbConstants.dbSchema.providers, {provider_id:requestParam.provider_id}, { _id:0, provider_id: 1} );
            if(!response){
                reject(errors(labels.LBL_USER_NOT_FOUND[config.default_language], responseCodes.ResourceNotFound));
                return;
            }
            let matchColumn = {provider_id: requestParam.provider_id, status: {$in:["accepted", "started"]}}
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
                    as: 'delOptDetails',
                },
            }, {
                $unwind: "$delOptDetails"
            }, { 
                $match : matchColumn
            }, { 
                $sort : {created_at:-1}
            }, {
                $project: {
                    _id: 0,
                    provider_id: 1,
                    customer_id: 1,
                    job_id: 1,
                    vehicle_id: 1,
                    delivery_option_id: 1,
                    pickup_from: 1,
                    pickup_landmark: 1,
                    pickup_address: 1,
                    pickup_latitude: 1,
                    pickup_longitude: 1,
                    delivery_landmark: 1,
                    delivery_address: 1,
                    delivery_latitude: 1,
                    delivery_longitude: 1,
                    pickup_contact_name: 1,
                    pickup_contact_number: 1,
                    pickup_instructions: 1,
                    delivery_contact_name: 1,
                    delivery_contact_number: 1,
                    delivery_instructions: 1,
                    item_name: 1,
                    weight: 1,
                    item_desc: 1,
                    item_authority: 1,
                    status: 1,
                    item_image: 1,
                    formatted_distance: 1,
                    formatted_duration: 1,
                    payment_type: 1,
                    collect_cash_from: 1,
                    total: 1,
                    discount: 1,
                    amount_pay: 1,
                    vehicle_name:"$vehDetails.name",
                    delivery_option_name:"$delOptDetails.name",
                    delivery_option_code:"$delOptDetails.code",
                }
            }];
            let lists = await query.joinWithAnd(dbConstants.dbSchema.jobs, joinArr);
            lists = JSON.parse(JSON.stringify(lists))
            await Promise.all(lists.map(async (elem) => {
                elem.due_in = ''
                let dt;
                let todayDate = moment(timeZone(new Date()).tz(requestParam.time_zone));
                if(elem.delivery_option_code == '2H'){
                    dt = moment(timeZone(new Date(elem.pickup_from)).tz(requestParam.time_zone).add(2, 'hours'));
                }
                if(elem.delivery_option_code == '4H'){
                    dt = moment(timeZone(new Date(elem.pickup_from)).tz(requestParam.time_zone).add(4, 'hours'));
                }
                if(elem.delivery_option_code == 'SAME_DAY'){
                    dt = moment(timeZone(new Date(elem.pickup_from)).tz(requestParam.time_zone));
                }
                let duration = moment.duration(dt.diff(todayDate));
                const hours = parseInt(duration.asHours());
                const minutes = parseInt(duration.asMinutes()) - hours * 60;
                elem.due_in = hours + "h " + minutes + "m";

                elem.pickup_from = timeZone(new Date(elem.pickup_from)).tz(requestParam.time_zone).format('DD MMM yyyy h:mm a')

                elem.item_image = elem.item_image != '' ? await imgHandler.getImage({bucket: config.aws.bucketName, key:`emzigo/customers/${elem.item_image}`}) : ''
                delete elem.delivery_option_code
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

const declineJob = async(requestParam) => {
    return new Promise(async(resolve, reject) => {
        try {
            let response = await query.selectWithAndOne(dbConstants.dbSchema.providers, {provider_id:requestParam.provider_id}, { _id:0, provider_id: 1} );
            if(!response){
                reject(errors(labels.LBL_USER_NOT_FOUND[config.default_language], responseCodes.ResourceNotFound));
                return;
            }
            let job = await query.selectWithAndOne(dbConstants.dbSchema.jobs, {job_id:requestParam.job_id}, { _id:0, job_id: 1, decline_reason:1} );
            if(!job){
                reject(errors(labels.LBL_JOB_NOT_FOUND[config.default_language], responseCodes.ResourceNotFound));
                return;
            }
            let decline_reason = job.decline_reason
            decline_reason.push({provider_id: requestParam.provider_id, reason: requestParam.decline_reason})
            await query.updateSingle(dbConstants.dbSchema.jobs, {status:'new', provider_id:'', decline_reason}, {job_id: requestParam.job_id});
            resolve(await encryptDecryptHandler.encrypt({}));
            return;
        } catch (error) {
            console.log(error)
            reject(error)
            return
        }
    })
};

const routesList = async(requestParam) => {
    return new Promise(async(resolve, reject) => {
        try {
            let response = await query.selectWithAndOne(dbConstants.dbSchema.providers, {provider_id:requestParam.provider_id}, { _id:0, provider_id: 1} );
            if(!response){
                reject(errors(labels.LBL_USER_NOT_FOUND[config.default_language], responseCodes.ResourceNotFound));
                return;
            }
            let compairData = {
                $and: [{
                    $or: [{
                        status: 'accepted'
                    }, {
                        status: 'started',
                    }, {
                        status: 'pickedup',
                    }]
                }, {
                    provider_id: requestParam.provider_id,
                }]
            }
            let jobs = await query.selectWithAnd(dbConstants.dbSchema.jobs, compairData, {_id:0, job_id:1, pickup_address:1, pickup_latitude:1, pickup_longitude:1, delivery_address:1, delivery_latitude:1, delivery_longitude:1, status:1, pickup_landmark:1, delivery_landmark:1, item_name:1, item_desc:1, formatted_distance:1, formatted_duration:1, }, {created_at:-1});
            jobs = JSON.parse(JSON.stringify(jobs))
            resolve(await encryptDecryptHandler.encrypt(jobs));
            return;
        } catch (error) {
            console.log(error)
            reject(error)
            return
        }
    })
};

const jobList = async(requestParam) => {
    return new Promise(async(resolve, reject) => {
        try {
            let response = await query.selectWithAndOne(dbConstants.dbSchema.providers, {provider_id:requestParam.provider_id}, { _id:0, provider_id: 1} );
            if(!response){
                reject(errors(labels.LBL_USER_NOT_FOUND[config.default_language], responseCodes.ResourceNotFound));
                return;
            }
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
                    as: 'delOptDetails',
                },
            }, {
                $unwind: "$delOptDetails"
            }, { 
                $match : {provider_id: requestParam.provider_id, status: 'pickedup'}
            }, { 
                $sort : {created_at:-1}
            }, {
                $project: {
                    _id: 0,
                    provider_id: 1,
                    customer_id: 1,
                    job_id: 1,
                    vehicle_id: 1,
                    delivery_option_id: 1,
                    pickup_from: 1,
                    pickup_landmark: 1,
                    pickup_address: 1,
                    pickup_latitude: 1,
                    pickup_longitude: 1,
                    delivery_landmark: 1,
                    delivery_address: 1,
                    delivery_latitude: 1,
                    delivery_longitude: 1,
                    pickup_contact_name: 1,
                    pickup_contact_number: 1,
                    pickup_instructions: 1,
                    delivery_contact_name: 1,
                    delivery_contact_number: 1,
                    delivery_instructions: 1,
                    item_name: 1,
                    weight: 1,
                    item_desc: 1,
                    item_authority: 1,
                    status: 1,
                    item_image: 1,
                    formatted_distance: 1,
                    formatted_duration: 1,
                    pickedup_at: 1,
                    payment_type: 1,
                    collect_cash_from: 1,
                    otp: 1,
                    total: 1,
                    discount: 1,
                    amount_pay: 1,
                    vehicle_name:"$vehDetails.name",
                    delivery_option_name:"$delOptDetails.name",
                    delivery_option_code:"$delOptDetails.code",
                }
            }];
            let lists = await query.joinWithAnd(dbConstants.dbSchema.jobs, joinArr);
            lists = JSON.parse(JSON.stringify(lists))
            await Promise.all(lists.map(async (elem) => {
                elem.due_in = ''
                let dt;
                let todayDate = timeZone(new Date()).tz(requestParam.time_zone);
                if(elem.delivery_option_code == '2H'){
                    dt = timeZone(new Date(elem.pickup_from)).tz(requestParam.time_zone).add(2, 'hours');
                }
                if(elem.delivery_option_code == '4H'){
                    dt = timeZone(new Date(elem.pickup_from)).tz(requestParam.time_zone).add(4, 'hours');
                }
                if(elem.delivery_option_code == 'SAME_DAY'){
                    dt = timeZone(new Date(elem.pickup_from)).tz(requestParam.time_zone);
                }
                let duration = moment.duration(dt.diff(todayDate));
                const hours = parseInt(duration.asHours());
                const minutes = parseInt(duration.asMinutes()) - hours * 60;
                elem.due_in = hours + "h " + minutes + "m";

                elem.pickup_from = timeZone(new Date(elem.pickup_from)).tz(requestParam.time_zone).format('DD MMM yyyy h:mm a')
                elem.pickedup_at = elem.pickedup_at ? timeZone(new Date(elem.pickedup_at)).tz(requestParam.time_zone).format('lll') : ''

                elem.item_image = elem.item_image != '' ? await imgHandler.getImage({bucket: config.aws.bucketName, key:`emzigo/customers/${elem.item_image}`}) : ''
                delete elem.delivery_option_code
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

const historyList = async(requestParam) => {
    return new Promise(async(resolve, reject) => {
        try {
            let response = await query.selectWithAndOne(dbConstants.dbSchema.providers, {provider_id:requestParam.provider_id}, { _id:0, provider_id: 1} );
            if(!response){
                reject(errors(labels.LBL_USER_NOT_FOUND[config.default_language], responseCodes.ResourceNotFound));
                return;
            }
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
                    as: 'delOptDetails',
                },
            }, {
                $unwind: "$delOptDetails"
            }, { 
                $match : {provider_id: requestParam.provider_id, status: {$in: ["delivered", "cancelled"]}}
            }, { 
                $sort : {delivered_at:-1}
            }, {
                $project: {
                    _id: 0,
                    provider_id: 1,
                    customer_id: 1,
                    job_id: 1,
                    vehicle_id: 1,
                    delivery_option_id: 1,
                    pickup_from: 1,
                    pickup_landmark: 1,
                    pickup_address: 1,
                    pickup_latitude: 1,
                    pickup_longitude: 1,
                    delivery_landmark: 1,
                    delivery_address: 1,
                    delivery_latitude: 1,
                    delivery_longitude: 1,
                    pickup_contact_name: 1,
                    pickup_contact_number: 1,
                    pickup_instructions: 1,
                    delivery_contact_name: 1,
                    delivery_contact_number: 1,
                    delivery_instructions: 1,
                    item_name: 1,
                    weight: 1,
                    item_desc: 1,
                    item_authority: 1,
                    status: 1,
                    item_image: 1,
                    formatted_distance: 1,
                    formatted_duration: 1,
                    pickedup_at: 1,
                    delivered_at: 1,
                    payment_type: 1,
                    collect_cash_from: 1,
                    total: 1,
                    discount: 1,
                    amount_pay: 1,
                    vehicle_name:"$vehDetails.name",
                    delivery_option_name:"$delOptDetails.name",
                }
            }];
            let lists = await query.joinWithAnd(dbConstants.dbSchema.jobs, joinArr);
            lists = JSON.parse(JSON.stringify(lists))
            await Promise.all(lists.map(async (elem) => {
                elem.pickup_from = timeZone(new Date(elem.pickup_from)).tz(requestParam.time_zone).format('DD MMM yyyy h:mm a')
                elem.pickedup_at = elem.pickedup_at ? timeZone(new Date(elem.pickedup_at)).tz(requestParam.time_zone).format('lll') : ''
                elem.delivered_at = elem.delivered_at ? timeZone(new Date(elem.delivered_at)).tz(requestParam.time_zone).format('lll') : ''
                elem.item_image = elem.item_image != '' ? await imgHandler.getImage({bucket: config.aws.bucketName, key:`emzigo/customers/${elem.item_image}`}) : ''
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

const getRatingsDeliveries = async(requestParam) => {
    return new Promise(async(resolve, reject) => {
        try {
            let response = await query.selectWithAndOne(dbConstants.dbSchema.providers, {provider_id:requestParam.provider_id}, { _id:0, provider_id: 1} );
            if(!response){
                reject(errors(labels.LBL_USER_NOT_FOUND[config.default_language], responseCodes.ResourceNotFound));
                return;
            }
            let compairData = {
                provider_id: requestParam.provider_id,
                status:'delivered'
            }
            let start, end;
            if(requestParam.type == 'TM'){
                start = moment().startOf('month').toDate();
                start = moment(start).format('YYYY-MM-DD')
                end = moment().endOf('month').toDate();
                end = moment(end).format('YYYY-MM-DD')
            }
            if(requestParam.type == 'LM'){
                start = moment().subtract(1, 'months').startOf('month');
                start = moment(start).format('YYYY-MM-DD')
                end = moment().subtract(1, 'months').endOf('month');
                end = moment(end).format('YYYY-MM-DD')
            }
            if(requestParam.type == 'TW'){
                start = moment().startOf('week').toDate();
                start = moment(start).format('YYYY-MM-DD')
                end = moment().endOf('week').toDate();
                end = moment(end).format('YYYY-MM-DD')
            }
            if(requestParam.type == 'LW'){
                start = moment().subtract(1, 'weeks').startOf('week');
                start = moment(start).format('YYYY-MM-DD')
                end = moment().subtract(1, 'weeks').endOf('week');
                end = moment(end).format('YYYY-MM-DD')
            }
            compairData.delivered_at = {
                $lte: new Date(end + 'T23:59:59.000Z'),
                $gte: new Date(start + 'T00:00:00.000Z')
            }
            let jobs = await query.selectWithAnd(dbConstants.dbSchema.jobs, compairData, {_id:0, job_id:1, is_customer_rated: 1, rating: 1}, {created_at:-1});
            let rating = 0;
            let ratingJob = 0;
            _.each(jobs, (elem) => {
                if(elem.is_customer_rated == true){
                    ratingJob += 1
                    rating += parseFloat(elem.rating.rating)
                }
            })
            let avg_rating = 0
            if(rating > 0 && ratingJob > 0){
                avg_rating = parseFloat(rating/ratingJob).toFixed(1)
            }
            let obj = {deliveries: jobs.length, rating: avg_rating}
            resolve(await encryptDecryptHandler.encrypt(obj));
            return;
        } catch (error) {
            console.log(error)
            reject(error)
            return
        }
    })
};

const pickedupJob = async(requestParam) => {
    return new Promise(async(resolve, reject) => {
        try {
            let response = await query.selectWithAndOne(dbConstants.dbSchema.providers, {provider_id:requestParam.provider_id}, { _id:0, provider_id:1} );
            if(!response){
                reject(errors(labels.LBL_USER_NOT_FOUND[config.default_language], responseCodes.ResourceNotFound));
                return;
            }
            let job = await query.selectWithAndOne(dbConstants.dbSchema.jobs, {job_id:requestParam.job_id}, { _id:0, job_id: 1, status:1, customer_id:1} );
            if(!job){
                reject(errors(labels.LBL_JOB_NOT_FOUND[config.default_language], responseCodes.ResourceNotFound));
                return;
            }
            let otp = Math.floor(1000 + Math.random() * 9000);
            await query.updateSingle(dbConstants.dbSchema.jobs, {status:'pickedup', pickedup_at:new Date(), provider_id: requestParam.provider_id, otp}, {job_id: requestParam.job_id});
            jobHandler.sendNotificationCustomer({customer_id: job.customer_id, title:'Tutume', code:'PICKEDUP_JOB', otp})
            resolve(await encryptDecryptHandler.encrypt({}));
            return;
        } catch (error) {
            console.log(error)
            reject(error)
            return
        }
    })
};

const startedJob = async(requestParam) => {
    return new Promise(async(resolve, reject) => {
        try {
            let response = await query.selectWithAndOne(dbConstants.dbSchema.providers, {provider_id:requestParam.provider_id}, { _id:0, provider_id:1} );
            if(!response){
                reject(errors(labels.LBL_USER_NOT_FOUND[config.default_language], responseCodes.ResourceNotFound));
                return;
            }
            let job = await query.selectWithAndOne(dbConstants.dbSchema.jobs, {job_id:requestParam.job_id}, { _id:0, job_id: 1, status:1, customer_id:1} );
            if(!job){
                reject(errors(labels.LBL_JOB_NOT_FOUND[config.default_language], responseCodes.ResourceNotFound));
                return;
            }
            await query.updateSingle(dbConstants.dbSchema.jobs, {status:'started', started_at:new Date(), provider_id: requestParam.provider_id}, {job_id: requestParam.job_id});
            jobHandler.sendNotificationCustomer({customer_id: job.customer_id, title:'Job Started', code:'START_JOB'})
            resolve(await encryptDecryptHandler.encrypt({}));
            return;
        } catch (error) {
            console.log(error)
            reject(error)
            return
        }
    })
};

const deliveredJob = async(requestParam, req) => {
    return new Promise(async(resolve, reject) => {
        try {
            if(requestParam.provider_id){
                requestParam.provider_id = await encryptDecryptHandler.decryptString(requestParam.provider_id)
            }
            if(requestParam.job_id){
                requestParam.job_id = await encryptDecryptHandler.decryptString(requestParam.job_id)
            }
            if(requestParam.delivery_recipient_name){
                requestParam.delivery_recipient_name = await encryptDecryptHandler.decryptString(requestParam.delivery_recipient_name)
            }
            if(requestParam.specified_recipient){
                requestParam.specified_recipient = await encryptDecryptHandler.decryptString(requestParam.specified_recipient)
            }
            if(requestParam.note){
                requestParam.note = await encryptDecryptHandler.decryptString(requestParam.note)
            }
            if(requestParam.is_safe){
                requestParam.is_safe = await encryptDecryptHandler.decryptString(requestParam.is_safe)
            }
            let response = await query.selectWithAndOne(dbConstants.dbSchema.providers, {provider_id:requestParam.provider_id}, { _id:0, provider_id:1} );
            if(!response){
                reject(errors(labels.LBL_USER_NOT_FOUND[config.default_language], responseCodes.ResourceNotFound));
                return;
            }
            let job = await query.selectWithAndOne(dbConstants.dbSchema.jobs, {job_id:requestParam.job_id}, { _id:0, job_id: 1, status:1, customer_id:1} );
            if(!job){
                reject(errors(labels.LBL_JOB_NOT_FOUND[config.default_language], responseCodes.ResourceNotFound));
                return;
            }
            if(req.files && req.files.signature_proof_image){
                requestParam.signature_proof_image = await imgHandler.uploadImage(req.files.signature_proof_image, config.aws.s3.providerBucket)
            }
            requestParam.status = 'delivered'
            requestParam.delivered_at = new Date()
            await query.updateSingle(dbConstants.dbSchema.jobs, requestParam, {job_id: requestParam.job_id});
            jobHandler.sendNotificationCustomer({customer_id: job.customer_id, title:'Job Delivered', code:'DELIVERED_JOB'})
            resolve(await encryptDecryptHandler.encrypt({}));
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
    assignList,
    getSort,
    create,
    update,
    action,
    sendNotification,
    trips,

    // FOR API
    signup,
    signin,
    updateProfile,
    profile,
    changePassword,
    logoutDelete,
    deliveriesForYou,
    declineJob,
    routesList,
    jobList,
    historyList,
    getRatingsDeliveries,
    pickedupJob,
    startedJob,
    deliveredJob,
};