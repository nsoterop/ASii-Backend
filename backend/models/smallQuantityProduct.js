const mongoose = require('mongoose');

const smallQuantityProductSchema = new mongoose.Schema({
    SupplierItemID: { type: String },
    MedChainItemCode: { type: String },
    PackingListDescritpion: {type: String},
    ManufacturerID: {type: String},
    ManufacturerName: { type: String },
    ProductID: { type: String },
    ProductName: { type: String },
    ProductDescription: { type: String },
    ItemID: {type: String},
    ItemName: { type: String },
    ItemImage: { type: String },
    Pkg: { type: String },
    UnitPrice: { type: Number },
    PriceDescription: { type: String },
    Availability: { type: String },
    PackingListDescritpion: { type: String },
    UnitVolume: { type: String },
    UOMFactor: { type: String },
    CountryOfOrigin: { type: String },
    HarmonizedTariffCode: { type: String },
    PrimaryCategoryID: {type: String},
    PrimaryCategoryName: {type: String},
    SecondaryCategoryID: {type: String},
    SecondaryCategoryName: {type: String},
    BrandID: {type: String},
    EDIUOM: {type: String},
    SalePrice: {type: Number}
})

module.exports = mongoose.model('SmallQuantityProduct', smallQuantityProductSchema)