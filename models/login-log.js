// grab the things we need
var mongoose = require('mongoose');
var Schema = mongoose.Schema;
const idGenerator = require('./../utils/id-generator');

// create a schema
var loginLogsSchema = new Schema({
    loginlog_id: {
        type: String,
        default:''
    },
    type: {
        type: String,
        default:''
    },
    login_id: {
        type: String,
        default:''
    },
    mobile: {
        type: String,
        default:''
    },
    name: {
        type: String,
        default:''
    },
    ip: {
        type: String,
        default:''
    },
    login_date: {
        type: Date,
        default: Date.now
    },
    logout_date: {
        type: Date
    },
    created_at: {
        type: Date,
        default: Date.now
    },
    updated_at: {
        type: Date,
        default: Date.now
    }
});

// // Execute before each user.save() call
loginLogsSchema.pre('save', async function(callback) {
    this.loginlog_id = await idGenerator.generateId('LOG'); 
});

var Login_log = mongoose.model('Login_log', loginLogsSchema);
module.exports = Login_log;