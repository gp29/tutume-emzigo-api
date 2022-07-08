'use strict';

var crypto = require('crypto');
var algorithm = 'aes-256-ctr';
var password = '0123456789abcdefghijklmnopqurstuvwxyzABCDEFGHIJKLMNOPQURSTUVWXYZ';

module.exports = {
    _saltLength: 16,

    _saltSet: '0123456789abcdefghijklmnopqurstuvwxyzABCDEFGHIJKLMNOPQURSTUVWXYZ',

    encrypt: function(text) {
        return new Promise((resolve, reject) => {
            let cipher = crypto.createCipher(algorithm,password)
            let crypted = cipher.update(text,'utf8','hex')
            crypted += cipher.final('hex');
            
            resolve(crypted);
            return;
        })
    },

    decrypt: function(text) {
        return new Promise((resolve, reject) => {
            let decipher = crypto.createDecipher(algorithm,password)
            let dec = decipher.update(text,'hex','utf8')
            dec += decipher.final('utf8');
            
            resolve(dec);
            return;
        })
    },
    
    /*
     * gets a new hash for password and salt
     * @param {Function} Callback with params {boolean}
     */
    newHash: function(pwToHashAndSalt, done) {
        this._createHash(pwToHashAndSalt, this._salt(), done);
    },

    /*
     * creates a new hash for password using sha256 and hexadecimal digest
     * @param {Function} Callback with params {saltObject}
     */
    _createHash: function(password, salt, done) {
        let saltedPW = crypto.createHash('sha256').update(salt + password).digest("hex");
        done(salt + saltedPW);
    },

    /*
     * Verifies an incoming password
     * @param {Function} Callback with params {boolean}
     */
    verify: function(incomingPW, hashedPw, done) {
        this._createHash(incomingPW, this._getSalt(hashedPw), function(newHash) {
            done(newHash === hashedPw);
        });
    },

    /*
     * creates a new salt for password of Admin User
     * @param {Value} Salt
     */
    _salt: function() {
        var saltString = '';
        for(let i = 0; i < this._saltLength; i++) {
            let target = Math.floor(Math.random() * this._saltSet.length);
            saltString += this._saltSet[target];
        }

        return saltString;
    },

    /*
     * Gets the new salt for password of Admin User
     * @param {Value} Salt
     */
    _getSalt: function(hashedAndSaltedPassword) {
        return hashedAndSaltedPassword.substring(0, this._saltLength);
    },

    randString: (x) => {
        let s = "";
        while(s.length<x&&x>0){
            let r = Math.random();
            s+= (r<0.1?Math.floor(r*100):String.fromCharCode(Math.floor(r*26) + (r>0.5?97:65)));
        }
        return s;
    }
};
