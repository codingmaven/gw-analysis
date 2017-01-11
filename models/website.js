/**
 * Created by bosko on 09/01/17.
 */

const mongoose = require('mongoose')

var WebsiteSchema = new mongoose.Schema({
    url: { type: String, required: true },
    originalUrl: { type: String },
    redirectUrl: { type: String },
    wappErrors: { type: Object },
    software: { type: Object },
    checked: { type: Boolean },
    lastChecked: { type: Date, default: Date.now() }
});

WebsiteSchema.index({ url: 1 });
WebsiteSchema.index({ url: 1, checked: 1 });
WebsiteSchema.index({ software: 1 });

module.exports = mongoose.model('Website', WebsiteSchema);
