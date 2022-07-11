'use strict';

const config = require('./../config');
const crypto = require('crypto');
const algorithm = 'aes-256-cbc';
const Securitykey = config.aes256.key;
const iv = config.aes256.iv;

const decryptString = (value) => {
    return new Promise((resolve, reject) => {
        async function main() { 
            try {
                const decipher = crypto.createDecipheriv(algorithm, Securitykey, iv);
                let decryptedData = decipher.update(value, "hex", "utf-8");
                decryptedData += decipher.final("utf8");
                resolve(decryptedData)
                return;
            } catch (error) {
                reject(error)
                return
            }
        }
        main()
    })
};

const decryptJson = (value) => {
    return new Promise((resolve, reject) => {
        async function main() { 
            try {
                const decipher = crypto.createDecipheriv(algorithm, Securitykey, iv);
                let decryptedData = decipher.update(value, "hex", "utf-8");
                decryptedData += decipher.final("utf8");
                resolve(JSON.parse(decryptedData))
                return;
            } catch (error) {
                reject(error)
                return
            }
        }
        main()
    })
};

const encrypt = (value) => {
    return new Promise((resolve, reject) => {
        async function main() { 
            try {
                const cipher = crypto.createCipheriv(algorithm, Securitykey, iv);
                let encryptedData = cipher.update(JSON.stringify(value), "utf-8", "hex");
                encryptedData += cipher.final("hex");
                resolve(encryptedData)
                return;
            } catch (error) {
                reject(error)
                return
            }
        }
        main()
    })
};

module.exports = {
    decryptString,
    decryptJson,
    encrypt
};