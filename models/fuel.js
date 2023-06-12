// grab the things we need
var mongoose = require('mongoose');
var Schema = mongoose.Schema;
const idGenerator = require('./../utils/id-generator');

// create a schema
var fuelSchema = new Schema({
    fuel_id: {
        type: String,
        default:''
    },
    name: {
        type: String,
        default:''
    },
    description: {
        type: String,
        default:''
    },
    rate_percentage: {
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
fuelSchema.pre('save', async function(callback) {
    this.fuel_id = await idGenerator.generateId('FUL'); 
});

var Fuel = mongoose.model('Fuel', fuelSchema);
module.exports = Fuel;