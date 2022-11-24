// grab the things we need
var mongoose = require('mongoose');
var Schema = mongoose.Schema;
const idGenerator = require('./../utils/id-generator');

// create a schema
var companySchema = new Schema({
    company_id: {
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
companySchema.pre('save', async function(callback) {
    this.company_id = await idGenerator.generateId('COM'); 
});

var Company = mongoose.model('Company', companySchema);
module.exports = Company;