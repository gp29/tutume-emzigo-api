// grab the things we need
var mongoose = require('mongoose');
var Schema = mongoose.Schema;
const idGenerator = require('./../utils/id-generator');

// create a schema
var pandaVehicleSchema = new Schema({
    vehicle_id: {
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
pandaVehicleSchema.pre('save', async function(callback) {
    this.vehicle_id = await idGenerator.generateId('VEH'); 
});

var Panda_vehicle = mongoose.model('Panda_vehicle', pandaVehicleSchema);
module.exports = Panda_vehicle;