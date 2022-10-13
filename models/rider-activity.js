// grab the things we need
var mongoose = require('mongoose');
var Schema = mongoose.Schema;
const idGenerator = require('./../utils/id-generator');

// create a schema
var riderActivitySchema = new Schema({
    activity_id: {
        type: String,
        default:''
    },
    user_id: {
        type: String,
        default:''
    },
    rider_id: {
        type: String,
        default:''
    },
    type: {
        type: String,
        default:''
    },
    amount: {
        type: Number,
        default:0
    },
    transaction_code: {
        type: String,
        default:''
    },
    by_whom: {
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
riderActivitySchema.pre('save', async function(callback) {
    this.activity_id = await idGenerator.generateId('RDA');
});

var Rider_activity = mongoose.model('Rider_activity', riderActivitySchema);
module.exports = Rider_activity;