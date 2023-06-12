// grab the things we need
var mongoose = require('mongoose');
var Schema = mongoose.Schema;
const idGenerator = require('./../utils/id-generator');

// create a schema
var headQuarterSchema = new Schema({
    head_quarter_id: {
        type: String,
        default:''
    },
    fuel_id: {
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
headQuarterSchema.pre('save', async function(callback) {
    this.head_quarter_id = await idGenerator.generateId('HDQ'); 
});

var Head_quarter = mongoose.model('Head_quarter', headQuarterSchema);
module.exports = Head_quarter;