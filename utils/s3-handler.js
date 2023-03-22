'use strict';

const config = require('../config');
const fs = require('fs');
const { PutObjectCommand, S3Client, DeleteObjectCommand } = require("@aws-sdk/client-s3");

const s3Client = new S3Client({
    endpoint: config.aws.endpoint,
    forcePathStyle:false,
    region: config.aws.region,
    credentials: {
        accessKeyId: config.aws.keyId,
        secretAccessKey: config.aws.key
    }
});

class S3Handler {

    imageUpload(requestParam) {
        return new Promise(async (resolve, reject) => {
            const file_data = fs.readFileSync(requestParam.path);
            if(requestParam.contentType == 'mp4'){
                requestParam.contentType = 'video/mp4'
            }
            if(requestParam.contentType == 'mp3'){
                requestParam.contentType = 'audio/mp3'
            }
            if(requestParam.contentType == 'MOV'){
                requestParam.contentType = 'video/MOV'
            }

            const params = {Bucket: config.aws.bucketName, Key: requestParam.bucket+'/'+requestParam.file_name, Body: file_data, ContentType : requestParam.contentType, ACL : 'public-read'};
            try {
                const data = await s3Client.send(new PutObjectCommand(params));
                resolve(data);
                return;
            } catch (e) {
                console.log(e);
                reject(e);
                return
            }
        })
    };

    pdfUpload(requestParam) {
        return new Promise(async (resolve, reject) => {
            const file_data = fs.readFileSync(requestParam.path);
            const params = {Bucket: config.aws.bucketName, Key: requestParam.bucket+'/'+requestParam.file_name, Body: file_data, ContentType : requestParam.contentType, ACL : 'public-read'};
            try {
                const data = await s3Client.send(new PutObjectCommand(params));
                resolve(data);
                return;
            } catch (e) {
                console.log(e);
                reject(e);
                return
            }
        })
    };

    imageDelete(requestParam) {
        return new Promise(async (resolve, reject) => {
            await Promise.all(requestParam.objects.map(async (elem) => {
                const bucketParams = { Bucket: requestParam.bucket, Key: elem.Key };
                await s3Client.send(new DeleteObjectCommand(bucketParams));
            }))
            resolve({});
            return
        })
    };

    async writeFile(file_data,fileName, bucket, contentType, done) {
        const params = {Bucket: config.aws.bucketName, Key: bucket+'/'+fileName, Body: file_data, ContentType : contentType, ACL : 'public-read'};
        try {
            const data = await s3Client.send(new PutObjectCommand(params));
            resolve(data);
            return;
        } catch (e) {
            console.log(e);
            reject(e);
            return
        }
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
