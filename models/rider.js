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
    address: {
        type: String,
        default:''
    },
    profile_photo: {
        type: String,
        default:''
    },
    driving_license: {
        type: String,
        default:''
    },
    nida_number: {
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
    total_balance: {
        type: Number,
        default:0
    },
    used_balance: {
        type: Number,
        default:0
    },
    region_id: {
        type: String,
        default:''
    },
    kijiwe_id: {
        type: String,
        default:''
    },
    referee_name: {
        type: String,
        default:''
    },
    referee_contact_number: {
        type: String,
        default:''
    },
    account_number: {
        type: Number,
        default:0
    },
    pin: {
        type: Number,
        default:0
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