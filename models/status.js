// grab the things we need
var mongoose = require('mongoose');
var Schema = mongoose.Schema;
const idGenerator = require('./../utils/id-generator');

// create a schema
var statusSchema = new Schema({
    status_id: {
        type: String,
        default:''
    },
    title: {
        type: String,
        default:''
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
statusSchema.pre('save', async function(callback) {
    this.status_id = await idGenerator.generateId('STS'); 
});

var Status = mongoose.model('Status', statusSchema);
module.exports = Status;