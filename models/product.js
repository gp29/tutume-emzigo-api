// grab the things we need
var mongoose = require('mongoose');
var Schema = mongoose.Schema;
const idGenerator = require('./../utils/id-generator');

// create a schema
var prodSchema = new Schema({
    product_id: {
        type: String,
        default:''
    },
    product_category_id: {
        type: String,
        default:''
    },
    name: {
        type: String,
        default:''
    },
    total_amount: {
        type: Number,
        default:0
    },
    no_of_installment: {
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
prodSchema.pre('save', async function(callback) {
    this.product_id = await idGenerator.generateId('PRD'); 
});

var Product = mongoose.model('Product', prodSchema);
module.exports = Product;