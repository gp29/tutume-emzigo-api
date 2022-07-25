'use strict';

const config = require('./../config');
const errors = require('./../utils/dz-errors');
const dbConstants = require('./../constants/db-constants');
const query = require('./../utils/query-creator');
const cms = require('./../models/cms');
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
            if(requestParam.cms_id){
                columnValue.cms_id = requestParam.cms_id
            }
            if(requestParam.status){
                columnValue.status = requestParam.status
            }
            let response = await query.selectWithAnd(dbConstants.dbSchema.cms, columnValue, { _id: 0}, { created_at: 1 });
            if(requestParam.cms_id){
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
                    cms_id: new RegExp(requestParam.text, 'i')
                }, {
                    title: new RegExp(requestParam.text, 'i')
                }, {
                    code: new RegExp(requestParam.text, 'i')
                }, {
                    type: new RegExp(requestParam.text, 'i')
                }];
            }
            let page = requestParam.page ? requestParam.page : 0 ;
            let sizePerPage = requestParam.sizePerPage ? requestParam.sizePerPage : 10 ;
            let skip = page * sizePerPage;
            let obj = {};

            let count = await query.countRecord(dbConstants.dbSchema.cms, columnAndValue);

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
                    cms_id: 1,
                    title: 1,
                    code: 1,
                    type: 1,
                }
            }];
            let data = await query.joinWithAnd(dbConstants.dbSchema.cms, joinArr);
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
            let fileName = requestParam.type+'_'+requestParam.code+".html";
            let ansTemplate;
            ansTemplate = fs.readFileSync('./public/cms_pages/cms.html', "utf8");
            ansTemplate = ansTemplate.replace('#CONTENT#', requestParam.description);
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
                await query.insertSingle(dbConstants.dbSchema.cms, requestParam);
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

const update = async(requestParam) => {
    return new Promise(async(resolve, reject) => {
        try {
            let fileName = requestParam.type+'_'+requestParam.code+".html";
            let ansTemplate;
            ansTemplate = fs.readFileSync('./public/cms_pages/cms.html', "utf8");
            ansTemplate = ansTemplate.replace('#CONTENT#', requestParam.description);
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
                await query.updateSingle(dbConstants.dbSchema.cms, requestParam, {cms_id: requestParam.cms_id});
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
                let response = await query.selectWithAnd(dbConstants.dbSchema.cms, {cms_id: {$in: requestParam.ids}}, { _id: 0, cms_id:1, link:1}, { created_at: 1 });
                let objects = []
                await Promise.all(response.map(async (elem) => {
                    objects.push({
                        Key: `emzigo/cms/${elem.link}`
                    });
                }))
                if(objects.length > 0) await imgHandler.deleteImage(objects, config.aws.bucketName)
                await query.removeMultiple(dbConstants.dbSchema.cms, { cms_id: { $in: requestParam['ids']}});
            }
            else{
                await query.updateMultiple(dbConstants.dbSchema.cms, {status: requestParam.type}, {cms_id: { $in: requestParam['ids']}});
            }
            resolve({});
            return;
        } catch (error) {
            reject(error)
            return
        }
    })
};

const list = async(requestParam) => {
    return new Promise(async(resolve, reject) => {
        try {
            let response = await query.selectWithAnd(dbConstants.dbSchema.cms, {type: requestParam.type}, { _id: 0, created_at:0, updated_at:0, __v:0}, { created_at: 1 });
            await Promise.all(response.map(async (elem) => {
                elem.link = elem.link != '' ? await imgHandler.getImage({bucket: config.aws.bucketName, key:`emzigo/cms/${elem.link}`}) : ''
            }))
            resolve(response);
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
    action,
    list
};