// grab the things we need
var mongoose = require('mongoose');
var Schema = mongoose.Schema;
const idGenerator = require('./../utils/id-generator');

// create a schema
var vehiclePriceSchema = new Schema({
    price_id: {
        type: String,
        default:''
    },
    vehicle_id: {
        type: String,
        default:''
    },
    delivery_option_id: {
        type: String,
        default:''
    },
    base_fare: {
        type: String,
        default:''
    },
    per_km_fare: {
        type: String,
        default:''
    },
    per_hour_fare: {
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
vehiclePriceSchema.pre('save', async function(callback) {
    this.price_id = await idGenerator.generateId('VHP'); 
});

var Vehicle_price = mongoose.model('Vehicle_price', vehiclePriceSchema);
module.exports = Vehicle_price;