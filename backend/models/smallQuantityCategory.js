const mongoose = require('mongoose');

const smallQuantityCategorySchema = new mongoose.Schema({
    CategoryPathID: { type: String },
    CategoryPathName: {type: String},
    SubCategories: {type: Array}
})

module.exports = mongoose.model('SmallQuantityCategory', smallQuantityCategorySchema)