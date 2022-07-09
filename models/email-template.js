// grab the things we need
var mongoose = require('mongoose');
var Schema = mongoose.Schema;
const idGenerator = require('./../utils/id-generator');

// create a schema
var emailTemplateSchema = new Schema({
    emailtemplate_id: {
        type: String,
        default: ''
    },
    title: {
        type: String,
        default: ''
    },
    code: {
        type: String,
        default: ''
    },
    from_name: {
        type: String,
        default: ''
    },
    from_email: {
        type: String,
        default: ''
    },
    email_subject: {
        type: String,
        default: ''
    },
    description: {
        type: String,
        default: ''
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
emailTemplateSchema.pre('save', async function(callback) {
    this.emailtemplate_id = await idGenerator.generateId('EMT'); 
});

var Email_template = mongoose.model('Email_template', emailTemplateSchema);
module.exports = Email_template;