// grab the things we need
var mongoose = require('mongoose');
var Schema = mongoose.Schema;
const idGenerator = require('./../utils/id-generator');

// create a schema
var faqCatSchema = new Schema({
    faq_category_id: {
        type: String,
        default:''
    },
    title: {
        type: String,
        default:''
    },
    type: {
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
faqCatSchema.pre('save', async function(callback) {
    this.faq_category_id = await idGenerator.generateId('FCT'); 
});

var Faq_category = mongoose.model('Faq_category', faqCatSchema);
module.exports = Faq_category;