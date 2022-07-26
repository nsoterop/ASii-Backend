const mongoose = require('mongoose');

const categorySchema = new mongoose.Schema({
    CategoryPathID: { type: String },
    CategoryPathName: {type: String},
    SubCategories: {type: Array}
})

module.exports = mongoose.model('Category', categorySchema)