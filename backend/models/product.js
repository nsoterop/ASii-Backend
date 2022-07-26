const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
    ItemID: { type: String },
    ManufacturerID: { type: String },
    ManufacturerName: { type: String },
    ProductID: { type: String },
    ProductName: { type: String },
    ProductDescription: { type: String },
    ManufacturerItemCode: { type: String },
    ItemDescription: { type: String },
    ItemImageURL: { type: String },
    NDCItemCode: { type: String },
    Pkg: { type: String },
    UnitPrice: { type: String },
    PriceDescription: { type: String },
    Availability: { type: String },
    CategoryPathID: { type: String },
    CategoryPathName: { type: String },
    PackingListDescritpion: { type: String },
    UnitWeight: { type: String },
    UnitVolume: { type: String },
    UOMFactor: { type: String },
    CountryOfOrigin: { type: String },
    HarmonizedTariffCode: { type: String },
    HazMatClass: { type: String },
    HazMatCode: { type: String },
    PharmacyProductType: { type: String },
    NationalDrugCode: { type: String },
    BrandID: { type: String },
    BrandName: { type: String }
})

module.exports = mongoose.model('Product', productSchema)