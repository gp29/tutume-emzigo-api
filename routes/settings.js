'use strict';

const responseCodes = require('./../utils/response-codes');
const jsonResponse = require('./../utils/json-response');
const config = require('./../config');
const errors = require('./../utils/dz-errors');
const express = require('express');
const router = express.Router();
const labels = require('./../utils/labels.json')
const settingsHandler = require('./../model_handlers/settings-handler');
const encryptDecryptHandler = require('./../model_handlers/encrypt-decrypt-handler');

router.get('/get', async(req, res) => {
    try {
        let response = await settingsHandler.get(req.query);
        jsonResponse(res, responseCodes.OK, null, response);
    } catch (error) {
        jsonResponse(res, error.code, error, null);
    }
});

router.post('/update', async(req, res) => {
    try {
        let response = await settingsHandler.update(req.body);
        jsonResponse(res, responseCodes.OK, null, response);
    } catch (error) {
        jsonResponse(res, error.code, error, null);
    }
});

router.get('/get-settings', async(req, res) => {
    try {
        req.query = await encryptDecryptHandler.decryptJson(req.query.encrypt_data)
        let response = await settingsHandler.get(req.query);
        jsonResponse(res, responseCodes.OK, null, await encryptDecryptHandler.encrypt(response));
    } catch (error) {
        jsonResponse(res, error.code, error, null);
    }
});

module.exports = router;