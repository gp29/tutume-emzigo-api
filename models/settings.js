// grab the things we need
var mongoose = require('mongoose');
var Schema = mongoose.Schema;
const idGenerator = require('./../utils/id-generator');

// create a schema
var settingsSchema = new Schema({
    settings_id: {
        type: String,
        default:''
    },
    currency: {
        type: String,
        default:''
    },
    fb_url:{
        type: String,
        default:''
    },
    twitter_url:{
        type: String,
        default:''
    },
    instagram_url:{
        type: String,
        default:''
    },
    linkedin_url:{
        type: String,
        default:''
    },
    call_us:{
        type: String,
        default:''
    },
    sos_number:{
        type: String,
        default:''
    },
    support_email:{
        type: String,
        default:''
    },
    whatsapp_number:{
        type: String,
        default:''
    },
    company_address:{
        type: String,
        default:''
    },
    rider_interest_percentage:{
        type: Number,
        default:0
    },
});

// // Execute before each user.save() call
settingsSchema.pre('save', async function(callback) {
    this.settings_id = await idGenerator.generateId('ROL'); 
});

var Settings = mongoose.model('Settings', settingsSchema);
module.exports = Settings;