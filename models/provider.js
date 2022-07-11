// grab the things we need
var mongoose = require('mongoose');
var Schema = mongoose.Schema;
const idGenerator = require('./../utils/id-generator');

// create a schema
var providerSchema = new Schema({
    provider_id: {
        type: String,
        default:''
    },
    vehicle_id: {
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
    mobile_country_code: {
        type: String,
        default:''
    },
    mobile: {
        type: String,
        default:''
    },
    password: {
        type: String,
        default:''
    },
    profile_photo: {
        type: String,
        default:''
    },
    id_photo: {
        type: String,
        default:''
    },
    address: {
        type: String,
        default:''
    },
    device_token: {
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
providerSchema.pre('save', async function(callback) {
    this.provider_id = await idGenerator.generateId('PRO'); 
});

var Provider = mongoose.model('Provider', providerSchema);
module.exports = Provider;