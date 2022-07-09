'use strict';

const config = require('./../config');
const errors = require('./../utils/dz-errors');
const dbConstants = require('./../constants/db-constants');
const query = require('./../utils/query-creator');
const faq = require('./../models/faq');
const _ = require('underscore');
const labels = require('./../utils/labels.json');
const responseCodes = require('./../utils/response-codes');
const timeZone = require('moment-timezone');
const imgHandler = require('./../model_handlers/image-handler');
const S3Handler = require('./../utils/s3-handler');
const s3Handler = new S3Handler();
let fs = require('fs');

const get = async(requestParam) => {
    return new Promise(async(resolve, reject) => {
        try {
            let columnValue = {}
            if(requestParam.faq_id){
                columnValue.faq_id = requestParam.faq_id
            }
            if(requestParam.status){
                columnValue.status = requestParam.status
            }
            let response = await query.selectWithAnd(dbConstants.dbSchema.faqs, columnValue, { _id: 0}, { created_at: 1 });
            if(requestParam.faq_id){
                response = response[0]
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

const getSort = async(requestParam) => {
    return new Promise(async(resolve, reject) => {
        try {
            let columnAndValue = {}
            if(requestParam.text && requestParam.text !=''){
                columnAndValue['$or'] = [{
                    faq_id: new RegExp(requestParam.text, 'i')
                }, {
                    question: new RegExp(requestParam.text, 'i')
                }, {
                    status: new RegExp(requestParam.text, 'i')
                }, {
                    'faqDetails.title': new RegExp(requestParam.text, 'i')
                }];
            }
            let page = requestParam.page ? requestParam.page : 0 ;
            let sizePerPage = requestParam.sizePerPage ? requestParam.sizePerPage : 10 ;
            let skip = page * sizePerPage;
            let obj = {};

            let count = await query.countRecord(dbConstants.dbSchema.faqs, columnAndValue);

            let joinArr = [{
                $lookup: {
                    from: 'faq_categories',
                    localField: 'faq_category_id',
                    foreignField: 'faq_category_id',
                    as: 'faqDetails',
                },
            }, {
                $unwind: "$faqDetails"
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
                    faq_id: 1,
                    question: 1,
                    status: 1,
                    faq_category: "$faqDetails.title",
                }
            }];
            let data = await query.joinWithAnd(dbConstants.dbSchema.faqs, joinArr);
            data = JSON.parse(JSON.stringify(data))
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

const create = async(requestParam) => {
    return new Promise(async(resolve, reject) => {
        try {
            let fileName = Math.floor(Math.random()*8999999+10000)+".html";
            let ansTemplate;
            ansTemplate = fs.readFileSync('./public/cms_pages/help.html', "utf8");
            ansTemplate = ansTemplate.replace('#QUESTION#', requestParam.question);
            ansTemplate = ansTemplate.replace('#ANSWER#', requestParam.answer);
            ansTemplate = ansTemplate.replace(/&lt;/g, '<');
            ansTemplate = ansTemplate.replace(/&gt;/g, '>');
            ansTemplate = ansTemplate.replace(/&quot;/g, '"');
            ansTemplate = ansTemplate.replace(/&ldquo;/g, '"');
            ansTemplate = ansTemplate.replace(/&rdquo;/g, '"');
            s3Handler.writeFile(ansTemplate, fileName, config.aws.s3.cmsBucket, 'html', async (error, pagePath) => {
                if (error) {
                    logger('Error: failed to Upload  HTML Page Failed with error:', error);
                    done(error, null);
                    return;
                }
                requestParam.link = fileName;
                await query.insertSingle(dbConstants.dbSchema.faqs, requestParam);
                resolve({});
                return;
            });
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
            let fileName = Math.floor(Math.random()*8999999+10000)+".html";
            let ansTemplate;
            ansTemplate = fs.readFileSync('./public/cms_pages/help.html', "utf8");
            ansTemplate = ansTemplate.replace('#QUESTION#', requestParam.question);
            ansTemplate = ansTemplate.replace('#ANSWER#', requestParam.answer);
            ansTemplate = ansTemplate.replace(/&lt;/g, '<');
            ansTemplate = ansTemplate.replace(/&gt;/g, '>');
            ansTemplate = ansTemplate.replace(/&quot;/g, '"');
            ansTemplate = ansTemplate.replace(/&ldquo;/g, '"');
            ansTemplate = ansTemplate.replace(/&rdquo;/g, '"');
            s3Handler.writeFile(ansTemplate, fileName, config.aws.s3.cmsBucket, 'html', async (error, pagePath) => {
                if (error) {
                    logger('Error: failed to Upload  HTML Page Failed with error:', error);
                    done(error, null);
                    return;
                }
                requestParam.link = fileName;
                await query.updateSingle(dbConstants.dbSchema.faqs, requestParam, {faq_id: requestParam.faq_id});
                resolve({});
                return;
            });
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
                let response = await query.selectWithAnd(dbConstants.dbSchema.faqs, {faq_id: {$in: requestParam.ids}}, { _id: 0, faq_id:1, link:1}, { created_at: 1 });
                let objects = []
                await Promise.all(response.map(async (elem) => {
                    objects.push({
                        Key: `emzigo/cms/${elem.link}`
                    });
                }))
                if(objects.length > 0) await imgHandler.deleteImage(objects, config.aws.bucketName)
                await query.removeMultiple(dbConstants.dbSchema.faqs, { faq_id: { $in: requestParam['ids']}});
            }
            else{
                await query.updateMultiple(dbConstants.dbSchema.faqs, {status: requestParam.type}, {faq_id: { $in: requestParam['ids']}});
            }
            resolve({});
            return;
        } catch (error) {
            reject(error)
            return
        }
    })
};

module.exports = {
    get,
    getSort,
    create,
    update,
    action
};