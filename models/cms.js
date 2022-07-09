// grab the things we need
var mongoose = require('mongoose');
var Schema = mongoose.Schema;
const idGenerator = require('./../utils/id-generator');

// create a schema
var cmsSchema = new Schema({
    cms_id: {
        type: String,
        default:''
    },
    title: {
        type: String,
        default:''
    },
    code: {
        type: String,
        default:''
    },
    type: {
        type: String,
        default:''
    },
    link: {
        type: String,
        default:''
    },
    description: {
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
cmsSchema.pre('save', async function(callback) {
    this.cms_id = await idGenerator.generateId('CMS'); 
});

var Cms = mongoose.model('Cms', cmsSchema);
module.exports = Cms;