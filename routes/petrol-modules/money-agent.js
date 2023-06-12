'use strict';

const responseCodes = require('./../../utils/response-codes');
const jsonResponse = require('./../../utils/json-response');
const express = require('express');
const router = express.Router();
const config = require('./../../config');
const labels = require('./../../utils/labels.json')
const errors = require('./../../utils/dz-errors');
const encryptDecryptHandler = require('./../../model_handlers/encrypt-decrypt-handler');
const handler = require('./../../model_handlers/petrol-modules/money-agent-handler');

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
        if (!req.query.rider_id) {
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

module.exports = router;