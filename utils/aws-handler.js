'use strict';

const AWS = require('aws-sdk');
const config = require('../config');

module.exports = {
    s3: function() {
    	AWS.config.update({
    		accessKeyId: config.aws.keyId,
    		secretAccessKey: config.aws.key,
    		region: config.aws.region 
		});
        return new AWS.S3();
    }
};
