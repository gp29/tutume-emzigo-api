// grab the things we need
var mongoose = require('mongoose');
var Schema = mongoose.Schema;
const idGenerator = require('./../utils/id-generator');

// create a schema
var pushTemplateSchema = new Schema({
    push_template_id: {
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
pushTemplateSchema.pre('save', async function(callback) {
    this.push_template_id = await idGenerator.generateId('PSN'); 
});

var Push_template = mongoose.model('Push_template', pushTemplateSchema);
module.exports = Push_template;