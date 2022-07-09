'use strict';

const awsHandler = require('./aws-handler');
const fs = require('fs');

class S3Handler {
    constructor() {
        this._objectsToUpload = null;
        this._s3 = awsHandler.s3();
    };

    imageUpload(requestParam) {
        return new Promise((resolve, reject) => {
            const file_data = fs.readFileSync(requestParam.path);
            if(requestParam.contentType == 'mp4'){
                requestParam.contentType = 'video/mp4'
            }
            //const params = {Bucket: requestParam.bucket, Key: requestParam.file_name, Body: file_data, ContentType : requestParam.contentType};
            const params = {Bucket: requestParam.bucket, Key: requestParam.file_name, Body: file_data, ContentType : requestParam.contentType, ACL : 'public-read'};
            this._s3.upload(params, (err, data)=> {
                if (err) {
                    reject(err);
                    return;
                }
                resolve(data);
                return
            });
        })
    };

    writeFile(file_data,fileName, bucket, contentType, done) {
        const params = {Bucket: bucket, Key: fileName, Body: file_data, ContentType : contentType, ACL : 'public-read'};
        this._s3.upload(params, function(err, data) {
            done(err, data);
        });
    };

    pdfUpload(requestParam) {
        return new Promise((resolve, reject) => {
            const file_data = fs.readFileSync(requestParam.path);
            const params = {Bucket: requestParam.bucket, Key: requestParam.file_name, Body: file_data, ContentType : requestParam.contentType, ACL : 'public-read'};
            this._s3.upload(params, (err, data)=> {
                if (err) {
                    reject(err);
                    return;
                }
                resolve(data);
                return
            });
        })
    };

    imageDelete(requestParam) {
        return new Promise((resolve, reject) => {
            const params = {
                Bucket: requestParam.bucket,
                Delete: {
                    Objects:requestParam.objects,
                    Quiet: false
                }
            };
            this._s3.deleteObjects(params, (error, data) => {
                if (error) {
                    reject(error);
                    return;
                }
                resolve(data);
                return
            });
        })
    };

    imageGet(requestParam) {
        return new Promise((resolve, reject) => {
            this._s3.getSignedUrl("getObject", {Bucket: requestParam.bucket, Key: requestParam.key, Expires: 300}, (error, s3Object)=> {
                if (error) {
                    reject(error);
                    return;
                }

                if (!s3Object) {
                    reject(new Error("null"));
                    return;
                }

                const formattedObject = {
                    body: s3Object,
                };
                resolve(formattedObject);
                return;
            });
        })
    };
}

module.exports = S3Handler;
