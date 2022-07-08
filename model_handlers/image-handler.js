'use strict';

const config = require('./../config');
const moment = require('moment');
const idGeneratorHandler = require('./../utils/id-generator');
const awsHandler = require('./../utils/s3-handler');
const AWSHandler = new awsHandler();

const uploadImage = (file, bucket) => {
    return new Promise((resolve, reject) => {
        async function main() { 
            try {
                const randomStr = await idGeneratorHandler.generateString(8, true, false, false); // length, number, letters, special
                const fileType = file.name.split('.').pop();
                file.file_name = `${moment().unix()}${randomStr}.${fileType}`;
                file.bucket = bucket;
                file.contentType = fileType;
                await AWSHandler.imageUpload(file);
                resolve(file.file_name);
                return;
            } catch (error) {
                reject(error);
                return;
            }
        }
        main()
    })
};

const deleteImage = (objects, bucket) => {
    return new Promise((resolve, reject) => {
        async function main() { 
            try {
                await AWSHandler.imageDelete({objects, bucket});
                resolve({});
                return;
            } catch (error) {
                reject(error);
                return;
            }
        }
        main()
    })
};

const getImage = (params) => {
    return new Promise((resolve, reject) => {
        async function main() { 
            try {
                let img = ''
                let key = /[^/]*$/.exec(params.key)[0]
                if(params.key.includes("customers") == true){
                    img = config.aws.prefix + config.aws.s3.customerBucket + '/' + key
                }
                resolve(img);
                return;
            } catch (error) {
                reject(error);
                return;
            }
        }
        main()
    })
};

module.exports = {
    uploadImage,
    deleteImage,
    getImage
};