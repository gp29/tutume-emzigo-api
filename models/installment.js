// grab the things we need
let mongoose = require('mongoose');
let Schema = mongoose.Schema;
const idGenerator = require('./../utils/id-generator');

// create a schema
let installmentSchema = new Schema({
    installment_id: {
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
    total_amount: {
        type: Number,
        default:0
    },
    no_of_installment: {
        type: Number,
        default:0
    },
    installments: {
        type: Array,
        default:[]
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

installmentSchema.pre('save', async function(callback) {
    this.installment_id = await idGenerator.generateId('INS'); 
});

let Installment = mongoose.model('Installment', installmentSchema);
module.exports = Installment;