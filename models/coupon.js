// grab the things we need
var mongoose = require('mongoose');
var Schema = mongoose.Schema;
const idGenerator = require('./../utils/id-generator');

// create a schema
var couponSchema = new Schema({
    coupon_id: {
        type: String,
        default:''
    },
    title: {
        type: String,
        default:''
    },
    coupon_code: {
        type: String,
        default:''
    },
    start_date: {
        type: String,
        default: '',
    },
    end_date: {
        type: String,
        default: '',
    },
    total_usage: {
        type: Number,
        default: 0,
    },
    total_used: {
        type: Number,
        default: 0,
    },
    value: {
        type: Number,
        default: 0,
    },
    type: {
        type: String,
        default: '',
    },
    status: {
        type: String,
        enum: ['active', 'inactive'],
        default: 'active'
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
couponSchema.pre('save', async function(callback) {
    this.coupon_id = await idGenerator.generateId('COU'); 
});

var Coupon = mongoose.model('Coupon', couponSchema);
module.exports = Coupon;