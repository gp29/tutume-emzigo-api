// grab the things we need
var mongoose = require('mongoose');
var Schema = mongoose.Schema;
const idGenerator = require('./../utils/id-generator');

// create a schema
var branchActivitySchema = new Schema({
    activity_id: {
        type: String,
        default:''
    },
    user_id: {
        type: String,
        default:''
    },
    branch_id: {
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
branchActivitySchema.pre('save', async function(callback) {
    this.activity_id = await idGenerator.generateId('HQA');
});

var Branch_activity = mongoose.model('Branch_activity', branchActivitySchema);
module.exports = Branch_activity;