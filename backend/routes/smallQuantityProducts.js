const express = require('express')
const SmallQuantityProduct = require('../models/smallQuantityProduct')
const SmallQuantityCategory = require('../models/smallQuantityCategory')
const sanitize = require('mongo-sanitize')
const router = express.Router()
const Realm = require('realm')
const env = require('../../environment')


router.get("/getById/:id", (req, res, next) => {
    SmallQuantityProduct.findById(req.params.id)
    .then(documents => {
        res.status(200).json(documents)
    });
})

router.get("/all/:pageNumber/:itemsPerPage", (req, res, next) => {
    SmallQuantityProduct.find()
    .sort('ItemID')
    .skip(req.params.itemsPerPage * (req.params.pageNumber - 1))
    .limit(req.params.itemsPerPage)
    .then(documents => {
        res.status(200).json(documents)
    });
})

router.get("/filterCategory/:pageNumber/:itemsPerPage/:category", (req, res, next) => {
    var query = sanitize(decodeURI(req.params.category));
    try {
        SmallQuantityProduct.find({
            $and : [ 
                { $or : [ 
                    {"CategoryPathID" : {$regex: query.toUpperCase()} }
                ]},
                { "UnitPrice" : {$not: /0.00/} }
            ]
        })
        .sort('ItemID')
        .skip(req.params.itemsPerPage * (req.params.pageNumber - 1))
        .limit(req.params.itemsPerPage)
        .then((documents) => {
            res.status(200).json(documents)
        });
    } catch (e) {
        console.log(e)
    }
})

router.post("/filterCategory/:pageNumber/:itemsPerPage", (req, res, next) => {
    var query = req.body.category
    console.log(query)
    try {
        SmallQuantityProduct.find({
            $and : [ 
                { $or : [ 
                    {"CategoryPathID" : {$regex: query.toUpperCase()} }
                ]},
                { "UnitPrice" : {$not: /0.00/} }
            ]
        })
        .sort('ItemID')
        .skip(req.params.itemsPerPage * (req.params.pageNumber - 1))
        .limit(req.params.itemsPerPage)
        .then((documents) => {
            res.status(200).json(documents)
        });
    } catch (e) {
        console.log(e)
    }
})

//search
router.get("/search/:pageNumber/:itemsPerPage/:query", async (req, res, next) => {
    var query = sanitize(req.params.query);
    try {
        await SmallQuantityProduct.aggregate(
            [
                {
                    $search: {
                        index: "searchSmallQuantityProducts",
                        text: {
                            query: query,
                            path: [
                            'ProductName',
                            'ItemName',
                            'ItemDescription'
                            ],
                            fuzzy: {}
                        }   
                    }
                },
                {
                    $skip: (parseInt(req.params.itemsPerPage) * parseInt(req.params.pageNumber - 1))
                },
                {
                    $limit: parseInt(req.params.itemsPerPage)
                }
            ]
        )
        .then(documents => {
            res.status(200).json(documents)
        });
    } catch (e) {
        console.log(e)
    }
})

router.get("/categories", (req, res, next) => {
    try {
        SmallQuantityCategory.find()
        .then((documents) => {
            res.status(200).json(documents)
        });
    } catch (e) {
        console.log(e)
    }
})

router.get("/updateSalePrice", async (req, res, next) => {
    try {
        await SmallQuantityProduct.aggregate(
            [
                {
                  '$addFields': {
                    'SalePrice': {
                      '$round': [
                        {
                          '$multiply': [
                            1.3, '$UnitPrice'
                          ]
                        }, 2
                      ]
                    }
                  }
                }
            ]
        )
        .then(async documents => {
            await documents.forEach(doc => Product.updateOne({_id: doc._id}, {$set: {"SalePrice": doc.SalePrice}}))
            res.status(200).json(documents)
        });
    } catch (e) {
        console.log(e)
    }
})

router.get("/autocomplete/:query", async (req, res, next) => {
    var query = sanitize(req.params.query);
    try {
        await SmallQuantityProduct.aggregate(
            [
                {
                    $search: {
                        index: "autoCompleteProducts",
                        "autocomplete": {
                            "query": query,
                            "path": "ProductName",
                            "tokenOrder": "sequential"
                        } 
                    }
                },
                {
                    $group: {
                        _id: { ProductName: "$ProductName" }
                    }
                },
                {
                    $limit: 7
                },
                {
                    $project: {
                        "ProductName": 1
                    }
                }                
            ]
        )
        .then(documents => {
            res.status(200).json(documents)
        });
    } catch (e) {
        console.log(e)
    }
})

router.get("/exactNameSearch/:pageNumber/:itemsPerPage/:name", (req, res, next) => {
    var name = sanitize(req.params.name);
    try {
        SmallQuantityProduct.find({
            $and : [ 
                { $or : [ 
                    {"ProductName" : name }
                ]},
                { "UnitPrice" : {$not: /0.00/} }
            ]
        })
        .skip(req.params.itemsPerPage * (req.params.pageNumber - 1))
        .limit(req.params.itemsPerPage)
        .then((documents) => {
            res.status(200).json(documents)
        });
    } catch (e) {
        console.log(e)
    }
})

module.exports = router;