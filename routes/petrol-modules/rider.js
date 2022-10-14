'use strict';

const responseCodes = require('./../../utils/response-codes');
const jsonResponse = require('./../../utils/json-response');
const express = require('express');
const router = express.Router();
const riderHandler = require('./../../model_handlers/petrol-modules/rider-handler');

router.post('/create', async(req, res) => {
    try {
        let requestParam = JSON.parse(req.body.fields);
        let response = await riderHandler.create(requestParam, req);
        jsonResponse(res, responseCodes.OK, null, response);
    } catch (error) {
        jsonResponse(res, error.code, error, null);
    }
});

router.post('/get-sort', async(req, res) => {
    try {
        let response = await riderHandler.getSort(req.body, req);
        jsonResponse(res, responseCodes.OK, null, response);
    } catch (error) {
        jsonResponse(res, error.code, error, null);
    }
});

router.get('/get', async(req, res) => {
    try {
        let response = await riderHandler.get(req.query);
        jsonResponse(res, responseCodes.OK, null, response);
    } catch (error) {
        jsonResponse(res, error.code, error, null);
    }
});

router.post('/action', async(req, res) => {
    try {
        let response = await riderHandler.action(req.body);
        jsonResponse(res, responseCodes.OK, null, response);
    } catch (error) {
        jsonResponse(res, error.code, error, null);
    }
});

router.post('/update', async(req, res) => {
    try {
        let requestParam = JSON.parse(req.body.fields);
        let response = await riderHandler.update(requestParam, req);
        jsonResponse(res, responseCodes.OK, null, response);
    } catch (error) {
        jsonResponse(res, error.code, error, null);
    }
});

router.post('/get-account', async(req, res) => {
    try {
        let response = await riderHandler.getAccount(req.body, req);
        jsonResponse(res, responseCodes.OK, null, response);
    } catch (error) {
        jsonResponse(res, error.code, error, null);
    }
});

router.post('/update-balance', async(req, res) => {
    try {
        let response = await riderHandler.updateBalance(req.body);
        jsonResponse(res, responseCodes.OK, null, response);
    } catch (error) {
        jsonResponse(res, error.code, error, null);
    }
});

router.post('/get-statement', async(req, res) => {
    try {
        let response = await riderHandler.getStatement(req.body, req);
        jsonResponse(res, responseCodes.OK, null, response);
    } catch (error) {
        jsonResponse(res, error.code, error, null);
    }
});

router.post('/settlement', async(req, res) => {
    try {
        let response = await riderHandler.settlement(req.body);
        jsonResponse(res, responseCodes.OK, null, response);
    } catch (error) {
        jsonResponse(res, error.code, error, null);
    }
});

module.exports = router;