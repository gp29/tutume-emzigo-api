// grab the things we need
var mongoose = require('mongoose');
var Schema = mongoose.Schema;
const idGenerator = require('./../utils/id-generator');

// create a schema
var vehicleSchema = new Schema({
    vehicle_id: {
        type: String,
        default:''
    },
    name: {
        type: String,
        default:''
    },
    weight: {
        type: String,
        default:''
    },
    icon: {
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
vehicleSchema.pre('save', async function(callback) {
    this.vehicle_id = await idGenerator.generateId('VEH'); 
});

var Vehicle = mongoose.model('Vehicle', vehicleSchema);
module.exports = Vehicle;