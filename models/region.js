// grab the things we need
var mongoose = require('mongoose');
var Schema = mongoose.Schema;
const idGenerator = require('./../utils/id-generator');

// create a schema
var regionSchema = new Schema({
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
regionSchema.pre('save', async function(callback) {
    this.region_id = await idGenerator.generateId('REG'); 
});

var Region = mongoose.model('Region', regionSchema);
module.exports = Region;