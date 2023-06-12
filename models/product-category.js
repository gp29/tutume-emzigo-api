// grab the things we need
var mongoose = require('mongoose');
var Schema = mongoose.Schema;
const idGenerator = require('./../utils/id-generator');

// create a schema
var productCatSchema = new Schema({
    product_category_id: {
        type: String,
        default:''
    },
    name: {
        type: String,
        default:''
    },
    fee_percentage: {
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
productCatSchema.pre('save', async function(callback) {
    this.product_category_id = await idGenerator.generateId('PDC'); 
});

var Product_category = mongoose.model('Product_category', productCatSchema);
module.exports = Product_category;