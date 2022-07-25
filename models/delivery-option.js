// grab the things we need
var mongoose = require('mongoose');
var Schema = mongoose.Schema;
const idGenerator = require('./../utils/id-generator');

// create a schema
var deliveryOptionSchema = new Schema({
    delivery_option_id: {
        type: String,
        default:''
    },
    name: {
        type: String,
        default:''
    },
    code: {
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
deliveryOptionSchema.pre('save', async function(callback) {
    this.delivery_option_id = await idGenerator.generateId('DEO'); 
});

var Delivery_option = mongoose.model('Delivery_option', deliveryOptionSchema);
module.exports = Delivery_option;