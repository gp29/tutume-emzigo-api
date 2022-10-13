// grab the things we need
var mongoose = require('mongoose');
var Schema = mongoose.Schema;
const idGenerator = require('./../utils/id-generator');

// create a schema
var riderSchema = new Schema({
    rider_id: {
        type: String,
        default:''
    },
    name: {
        type: String,
        default:''
    },
    email: {
        type: String,
        default:''
    },
    mobile: {
        type: String,
        default:''
    },
    qrcode: {
        type: String,
        default:''
    },
    qrcode_pdf: {
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
riderSchema.pre('save', async function(callback) {
    this.rider_id = await idGenerator.generateId('RDR');
});

var Rider = mongoose.model('Rider', riderSchema);
module.exports = Rider;