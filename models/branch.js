// grab the things we need
var mongoose = require('mongoose');
var Schema = mongoose.Schema;
const idGenerator = require('./../utils/id-generator');

// create a schema
var branchSchema = new Schema({
    branch_id: {
        type: String,
        default:''
    },
    head_quarter_id: {
        type: String,
        default:''
    },
    branch_name: {
        type: String,
        default:''
    },
    registration_id: {
        type: String,
        default:''
    },
    password: {
        type: String,
        default:''
    },
    branch_contact_no: {
        type: String,
        default:''
    },
    branch_contact_email: {
        type: String,
        default:''
    },
    branch_manager_name: {
        type: String,
        default:''
    },
    branch_manager_contact_no: {
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
branchSchema.pre('save', async function(callback) {
    this.branch_id = await idGenerator.generateId('BRA');
});

var Branch = mongoose.model('Branch', branchSchema);
module.exports = Branch;