// grab the things we need
var mongoose = require('mongoose');
var Schema = mongoose.Schema;
const idGenerator = require('./../utils/id-generator');

// create a schema
var jobSchema = new Schema({
    job_id: {
        type: String,
        default:''
    },
    user_id: {
        type: String,
        default:''
    },
    customer_id: {
        type: String,
        default:''
    },
    provider_id: {
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
    pickup_from: {
        type: Date,
        //default: Date.now
    },
    pickup_landmark: {
        type: String,
        default: ''
    },
    pickup_address: {
        type: String,
        default: ''
    },
    pickup_latitude: {
        type: Number,
        default: 0
    },
    pickup_longitude: {
        type: Number,
        default: 0
    },
    delivery_landmark: {
        type: String,
        default: ''
    },
    delivery_address: {
        type: String,
        default: ''
    },
    delivery_latitude: {
        type: Number,
        default: 0
    },
    delivery_longitude: {
        type: Number,
        default: 0
    },
    total_distance: {
        type: Number,
        default:0
    },
    total_duration: {
        type: Number,
        default:0
    },
    formatted_distance: {
        type: String,
        default:''
    },
    formatted_duration: {
        type: String,
        default:''
    },
    pickup_contact_name: {
        type: String,
        default: ''
    },
    pickup_contact_number: {
        type: String,
        default: ''
    },
    pickup_instructions: {
        type: String,
        default: ''
    },
    delivery_contact_name: {
        type: String,
        default: ''
    },
    delivery_contact_number: {
        type: String,
        default: ''
    },
    delivery_instructions: {
        type: String,
        default: ''
    },
    item_name: {
        type: String,
        default:''
    },
    item_desc: {
        type: String,
        default:''
    },
    item_authority: {
        type: String,
        default: ''
    },
    total: {
        type: Number,
        default:0
    },
    discount: {
        type: Number,
        default:0
    },
    amount_pay: {
        type: Number,
        default:0
    },
    coupon_id: {
        type: String,
        default:''
    },
    collect_cash_from:{
        type: String,
        default:''
    },
    transaction_id: {
        type: String,
        default:''
    },
    payment_type: {
        type: String,
        default:'cash'
    },
    status: {
        type: String,
        default:'new'
    },
    delivery_recipient_name: {
        type: String,
        default:''
    },
    specified_recipient: {
        type: String,
        default:''
    },
    note: {
        type: String,
        default:''
    },
    is_safe: {
        type: String,
        default:''
    },
    signature_proof_image: {
        type: String,
        default:''
    },
    decline_reason: {
        type: Array,
        default:[]
    },
    is_customer_rated: {
        type: Boolean,
        default:false
    },
    rating: {
        type: Object,
        default: {
            rating: '',
            comment: ''
        }
    },
    accepted_at: {
        type: Date
    },
    pickedup_at: {
        type: Date
    },
    delivered_at: {
        type: Date
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
jobSchema.pre('save', async function(callback) {
    this.job_id = await idGenerator.generateId('JOB'); 
});

let Job = mongoose.model('Job', jobSchema);
module.exports = Job;