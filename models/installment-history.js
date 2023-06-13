// grab the things we need
let mongoose = require('mongoose');
let Schema = mongoose.Schema;
const idGenerator = require('./../utils/id-generator');

// create a schema
let installmentHistorySchema = new Schema({
    installment_activity_id: {
        type: String,
        default:''
    },
    user_id: {
        type: String,
        default:''
    },
    rider_id: {
        type: String,
        default:''
    },
    product_id: {
        type: String,
        default:''
    },
    installment_no: {
        type: Number,
        default:0
    },
    amount: {
        type: Number,
        default:0
    },
    commission_percentage: {
        type: Number,
        default:0
    },
    commission_amount: {
        type: Number,
        default:0
    },
    need_to_pay_amount: {
        type: Number,
        default:0
    },
    date: {
        type: String,
        default: ''
    },
    status: {
        type: String,
        default: 'unsettled'
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

installmentHistorySchema.pre('save', async function(callback) {
    this.installment_activity_id = await idGenerator.generateId('ISA'); 
});

let Installment_history = mongoose.model('Installment_history', installmentHistorySchema);
module.exports = Installment_history;