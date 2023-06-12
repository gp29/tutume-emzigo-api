'use strict';

const responseCodes = require('./../../utils/response-codes');
const jsonResponse = require('./../../utils/json-response');
const express = require('express');
const router = express.Router();
const config = require('./../../config');
const labels = require('./../../utils/labels.json')
const errors = require('./../../utils/dz-errors');
const handler = require('./../../model_handlers/petrol-modules/fuel-handler');

router.post('/create', async(req, res) => {
    try {
        let response = await handler.create(req.body);
        jsonResponse(res, responseCodes.OK, null, response);
    } catch (error) {
        jsonResponse(res, error.code, error, null);
    }
});

router.post('/get-sort', async(req, res) => {
    try {
        let response = await handler.getSort(req.body);
        jsonResponse(res, responseCodes.OK, null, response);
    } catch (error) {
        jsonResponse(res, error.code, error, null);
    }
});

router.get('/get', async(req, res) => {
    try {
        let response = await handler.get(req.query);
        jsonResponse(res, responseCodes.OK, null, response);
    } catch (error) {
        jsonResponse(res, error.code, error, null);
    }
});

router.post('/action', async(req, res) => {
    try {
        let response = await handler.action(req.body);
        jsonResponse(res, responseCodes.OK, null, response);
    } catch (error) {
        jsonResponse(res, error.code, error, null);
    }
});

router.post('/update', async(req, res) => {
    try {
        let response = await handler.update(req.body);
        jsonResponse(res, responseCodes.OK, null, response);
    } catch (error) {
        jsonResponse(res, error.code, error, null);
    }
});

module.exports = router;