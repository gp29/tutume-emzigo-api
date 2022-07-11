'use strict';

const responseCodes = require('./../utils/response-codes');
const jsonResponse = require('./../utils/json-response');
const config = require('./../config');
const errors = require('./../utils/dz-errors');
const express = require('express');
const router = express.Router();
const dashboardHandler = require('./../model_handlers/dashboard-handler');
const labels = require('./../utils/labels.json')

router.get('/get-statistics', async(req, res) => {
    try {
        let response = await dashboardHandler.getStatistics(req.query);
        jsonResponse(res, responseCodes.OK, null, response);
    } catch (error) {
        jsonResponse(res, error.code, error, null);
    }
});

router.get('/graph', async(req, res) => {
    try {
        let response = await dashboardHandler.graph(req.query);
        jsonResponse(res, responseCodes.OK, null, response);
    } catch (error) {
        jsonResponse(res, error.code, error, null);
    }
});

module.exports = router;