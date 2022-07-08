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
    }
});

// // Execute before each user.save() call
settingsSchema.pre('save', async function(callback) {
    this.settings_id = await idGenerator.generateId('ROL'); 
});

var Settings = mongoose.model('Settings', settingsSchema);
module.exports = Settings;