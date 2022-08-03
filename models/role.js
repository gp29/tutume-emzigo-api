// grab the things we need
var mongoose = require('mongoose');
var Schema = mongoose.Schema;
const idGenerator = require('./../utils/id-generator');

// create a schema
var roleSchema = new Schema({
    role_id: {
        type: String,
        default:''
    },
    title: {
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
roleSchema.pre('save', async function(callback) {
    this.role_id = await idGenerator.generateId('ROL'); 
});

var Role = mongoose.model('Role', roleSchema);
module.exports = Role;