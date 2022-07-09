// grab the things we need
var mongoose = require('mongoose');
var Schema = mongoose.Schema;
const idGenerator = require('./../utils/id-generator');

// create a schema
var faqSchema = new Schema({
    faq_id: {
        type: String,
        default:''
    },
    faq_category_id: {
        type: String,
        default:''
    },
    question: {
        type: String,
        default:''
    },
    answer: {
        type: String,
        default:''
    },
    link: {
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
faqSchema.pre('save', async function(callback) {
    this.faq_id = await idGenerator.generateId('FAQ'); 
});

var Faq = mongoose.model('Faq', faqSchema);
module.exports = Faq;