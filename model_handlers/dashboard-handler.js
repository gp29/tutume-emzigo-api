'use strict';

const config = require('./../config');
const errors = require('./../utils/dz-errors');
const dbConstants = require('./../constants/db-constants');
const query = require('./../utils/query-creator');
const labels = require('./../utils/labels.json');
const responseCodes = require('./../utils/response-codes');
const _ = require('underscore');
const timeZone = require('moment-timezone');
const LD = require('lodash');
const monthName = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

const getStatistics = async(requestParam) => {
    return new Promise(async(resolve, reject) => {
        try {
            let customers = await query.countRecord(dbConstants.dbSchema.customers, {});
            let providers = await query.countRecord(dbConstants.dbSchema.providers, {});
            let vehicles = await query.countRecord(dbConstants.dbSchema.vehicles, {});
            let jobs = await query.countRecord(dbConstants.dbSchema.jobs, {});
            resolve({customers, providers, vehicles, jobs})
            return;
            resolve(response);
            return;
        } catch (error) {
            reject(error)
            return
        }
    })
};

const graph = async(requestParam) => {
    return new Promise(async(resolve, reject) => {
        try {
            let year = new Date().getFullYear()
            let promise = [];
            for (let x in monthName) {
                promise.push(await overAllCountJobs(monthName[x], x, year))
            }
            Promise.all(promise)
            .then(async result => {
                resolve(result);
                return;
            });
        } catch (error) {
            console.log(error)
            reject(error)
            return
        }
    })
};

const overAllCountJobs = (month, index, year) => {
    return new Promise(async(resolve, reject) => {
        try {
            let date = new Date(),
            y = year,
            m = parseInt(index);
            let firstDay = new Date(y, m, 1);
            firstDay.setHours(0, 0, 0, 0);
            let lastDay = new Date(y, m + 1, 0);
            lastDay.setHours(23, 59, 59, 999);
            let compairData = {
                status: 'delivered',
                created_at: {
                    $gte: firstDay,
                    $lt: lastDay
                }
            }
            let jobs = await query.selectWithAnd(dbConstants.dbSchema.jobs, compairData, { _id: 0, total:1}, { created_at: 1 });
            let sales = LD.sumBy(jobs, 'total');
            resolve(parseFloat(parseFloat(sales).toFixed(2)));
            return;
        } catch (error) {
            console.log(error)
            reject(error)
            return
        }
    })
};

const receivedAmount = (requestParam) => {
    return new Promise(async(resolve, reject) => {
        try {
            let start = timeZone(new Date(requestParam.start_date)).tz(requestParam.time_zone).format('YYYY-MM-DD')
            let end = timeZone(new Date(requestParam.end_date)).tz(requestParam.time_zone).format('YYYY-MM-DD')
            let compairData = {
                paid_status: 'paid',
                created_at: {
                    $lte: new Date(end + 'T23:59:59.000Z'),
                    $gte: new Date(start + 'T00:00:00.000Z')
                }
            }
            let jobs = await query.selectWithAnd(dbConstants.dbSchema.jobs, compairData, { _id: 0, total:1}, { created_at: 1 });
            let sales = LD.sumBy(jobs, 'total');
            resolve(parseFloat(sales).toFixed(2));
            return;
        } catch (error) {
            console.log(error)
            reject(error)
            return
        }
    })
};

module.exports = {
    getStatistics,
    graph,
    receivedAmount
};