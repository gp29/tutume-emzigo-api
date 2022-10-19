// grab the things we need
var mongoose = require('mongoose');
var Schema = mongoose.Schema;
const idGenerator = require('./../utils/id-generator');

// create a schema
var kijiweSchema = new Schema({
    kijiwe_id: {
        type: String,
        default:''
    },
    region_id: {
        type: String,
        default:''
    },
    name: {
        type: String,
        default:''
    },
    status: {
        type: String,
        default:'active'
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
kijiweSchema.pre('save', async function(callback) {
    this.kijiwe_id = await idGenerator.generateId('KJW');
});

var Kijiwe = mongoose.model('Kijiwe', kijiweSchema);
module.exports = Kijiwe;