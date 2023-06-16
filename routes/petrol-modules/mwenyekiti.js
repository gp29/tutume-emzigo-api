'use strict';

const responseCodes = require('./../../utils/response-codes');
const jsonResponse = require('./../../utils/json-response');
const express = require('express');
const router = express.Router();
const config = require('./../../config');
const labels = require('./../../utils/labels.json')
const errors = require('./../../utils/dz-errors');
const encryptDecryptHandler = require('./../../model_handlers/encrypt-decrypt-handler');
const handler = require('./../../model_handlers/petrol-modules/mwenyekiti-handler');

router.post('/signin', async(req, res) => {
    try {
        req.body = await encryptDecryptHandler.decryptJson(req.body.encrypt_data)
        req.body.time_zone = config.time_zone
        if(req.headers.time_zone){
            req.body.time_zone = req.headers.time_zone
        }
        if (!req.body.mobile || !req.body.password) {
            jsonResponse(res, responseCodes.BadRequest, errors(labels.LBL_MISSING_PARAMETERS[config.default_language], responseCodes.BadRequest), null)
            return
        }
        let response = await handler.signin(req.body);
        jsonResponse(res, responseCodes.OK, null, response);
    } catch (error) {
        console.log(error)
        jsonResponse(res, error.code, error, null);
    }
});

router.get('/profile', async(req, res) => {
    try {
        req.query = await encryptDecryptHandler.decryptJson(req.query.encrypt_data)
        req.query.time_zone = config.time_zone
        if(req.headers.time_zone){
            req.query.time_zone = req.headers.time_zone
        }
        if (!req.query.user_id) {
            jsonResponse(res, responseCodes.BadRequest, errors(labels.LBL_MISSING_PARAMETERS[config.default_language], responseCodes.BadRequest), null)
            return
        }
        let response = await handler.profile(req.query);
        jsonResponse(res, responseCodes.OK, null, response);
    } catch (error) {
        console.log(error)
        jsonResponse(res, error.code, error, null);
    }
});

router.get('/rider-list', async(req, res) => {
    try {
        req.query = await encryptDecryptHandler.decryptJson(req.query.encrypt_data)
        req.query.time_zone = config.time_zone
        if(req.headers.time_zone){
            req.query.time_zone = req.headers.time_zone
        }
        if (!req.query.user_id) {
            jsonResponse(res, responseCodes.BadRequest, errors(labels.LBL_MISSING_PARAMETERS[config.default_language], responseCodes.BadRequest), null)
            return
        }
        let response = await handler.riderList(req.query);
        jsonResponse(res, responseCodes.OK, null, response);
    } catch (error) {
        console.log(error)
        jsonResponse(res, error.code, error, null);
    }
});

router.get('/region-list', async(req, res) => {
    try {
        req.query = await encryptDecryptHandler.decryptJson(req.query.encrypt_data)
        req.query.time_zone = config.time_zone
        if(req.headers.time_zone){
            req.query.time_zone = req.headers.time_zone
        }
        if (!req.query.user_id) {
            jsonResponse(res, responseCodes.BadRequest, errors(labels.LBL_MISSING_PARAMETERS[config.default_language], responseCodes.BadRequest), null)
            return
        }
        let response = await handler.regionList(req.query);
        jsonResponse(res, responseCodes.OK, null, response);
    } catch (error) {
        console.log(error)
        jsonResponse(res, error.code, error, null);
    }
});

router.get('/kijiwe-list', async(req, res) => {
    try {
        req.query = await encryptDecryptHandler.decryptJson(req.query.encrypt_data)
        req.query.time_zone = config.time_zone
        if(req.headers.time_zone){
            req.query.time_zone = req.headers.time_zone
        }
        if (!req.query.user_id || !req.query.region_id) {
            jsonResponse(res, responseCodes.BadRequest, errors(labels.LBL_MISSING_PARAMETERS[config.default_language], responseCodes.BadRequest), null)
            return
        }
        let response = await handler.kijiweList(req.query);
        jsonResponse(res, responseCodes.OK, null, response);
    } catch (error) {
        console.log(error)
        jsonResponse(res, error.code, error, null);
    }
});

router.get('/vehicle-list', async(req, res) => {
    try {
        req.query = await encryptDecryptHandler.decryptJson(req.query.encrypt_data)
        req.query.time_zone = config.time_zone
        if(req.headers.time_zone){
            req.query.time_zone = req.headers.time_zone
        }
        if (!req.query.user_id) {
            jsonResponse(res, responseCodes.BadRequest, errors(labels.LBL_MISSING_PARAMETERS[config.default_language], responseCodes.BadRequest), null)
            return
        }
        let response = await handler.vehicleList(req.query);
        jsonResponse(res, responseCodes.OK, null, response);
    } catch (error) {
        console.log(error)
        jsonResponse(res, error.code, error, null);
    }
});

router.post('/create-rider', async(req, res) => {
    try {
        req.body.time_zone = config.time_zone
        if(req.headers.time_zone){
            req.body.time_zone = req.headers.time_zone
        }
        if (!req.body.user_id || !req.body.name || !req.body.mobile || !req.body.password || !req.body.address || !req.files.profile_photo || !req.files.driving_license) {
            jsonResponse(res, responseCodes.BadRequest, errors(labels.LBL_MISSING_PARAMETERS[config.default_language], responseCodes.BadRequest), null)
            return
        }
        if (!req.body.nida_number || !req.body.region_id || !req.body.kijiwe_id || !req.body.vehicle_id || !req.body.referee_name || !req.body.referee_contact_number || !req.body.fuel_credit_limit) {
            jsonResponse(res, responseCodes.BadRequest, errors(labels.LBL_MISSING_PARAMETERS[config.default_language], responseCodes.BadRequest), null)
            return
        }
        let response = await handler.createRider(req.body, req);
        jsonResponse(res, responseCodes.OK, null, response);
    } catch (error) {
        console.log(error)
        jsonResponse(res, error.code, error, null);
    }
});

module.exports = router;