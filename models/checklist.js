// grab the things we need
var mongoose = require('mongoose');
var Schema = mongoose.Schema;
const idGenerator = require('./../utils/id-generator');

// create a schema
var checklistSchema = new Schema({
    checklist_id: {
        type: String,
        default:''
    },
    name: {
        type: String,
        default:''
    },
    description: {
        type: String,
        default:''
    },
    percentage: {
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
checklistSchema.pre('save', async function(callback) {
    this.checklist_id = await idGenerator.generateId('CKL'); 
});

var Checklist = mongoose.model('Checklist', checklistSchema);
module.exports = Checklist;