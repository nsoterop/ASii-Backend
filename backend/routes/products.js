const express = require('express')
const Product = require('../models/product')
const Category = require('../models/category')
const sanitize = require('mongo-sanitize')
const router = express.Router()
const Realm = require('realm')
const square = require('square')
const { v4: uuidv4 } = require('uuid')
const env = require('../../environment')
const nodemailer = require('nodemailer')

const client = new square.Client({
    accessToken: env.SQUARE_ACCESS_TOKEN,
    environment: square.Environment.Production,
});

const { validatePaymentPayload, validateCreateCardPayload } = require('../models/schema');

router.get("/getById/:id", (req, res, next) => {
    Product.findById(req.params.id)
    .then(documents => {
        res.status(200).json(documents)
    });
})

router.get("/all/:pageNumber/:itemsPerPage", (req, res, next) => {
    Product.find()
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
        Product.find({
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
    try {
        Product.find({
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
        await Product.aggregate(
            [
                {
                    $search: {
                        index: "searchProducts",
                        text: {
                            query: query,
                            path: [
                            'ProductName',
                            'NDCItemCode',
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
        Category.find()
        .then((documents) => {
            res.status(200).json(documents)
        });
    } catch (e) {
        console.log(e)
    }
})

router.get("/updateSalePrice", async (req, res, next) => {
    try {
        await Product.aggregate(
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
        await Product.aggregate(
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
        Product.find({
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

router.post('/order', async (req, res) => {
    let cart = JSON.parse(req.body.cart).items
    let costDetails = req.body.costDetails
    let items = [];

    cart.forEach((item) => {
        items.push({
        name: item.ProductName,
        quantity: String(item.quantity),
        basePriceMoney: {
            amount: Math.trunc(item.SalePrice * 100),
            currency: 'USD',
        },
        metadata: {
            productId: item.ProductID,
            itemId: item.ItemID,
        },
        });
    });

    let taxes = [
        {
            name: "Sales Tax",
            percentage: String(costDetails.salesTax)
        }
    ]

    let serviceCharges = [{
        amountMoney: {
            amount: costDetails.serviceFee,
            currency: 'USD'
        }
    }]

    try {
        const response = await client.ordersApi.createOrder({
          order: {
            locationId: env.LOCATION_ID,
            lineItems: items,
            serviceCharges: serviceCharges,
            taxes: taxes
          },
          idempotencyKey: uuidv4()
        });
        let responseBody = {
            orderId: response.result.order.id,
            totalAmount: Number(response.result.order.netAmounts.totalMoney.amount)
        }
        res.status(200).json(responseBody);
      } catch(error) {
        console.log(error);
      }
})

router.post('/createPayment', async (req, res) => {
    const payload = req.body


    let emailBody = {
        costDetails: payload.costDetails,
        companyName: payload.companyName,
        shippingAccountNumber: payload.shippingAccountNumber,
        buyerEmailAddress: payload.buyerEmailAddress,
        shippingAddress: payload.shippingAddress,
        phone: payload.phone,
        firstname: payload.firstname,
        lastname: payload.lastname,
        companyName: payload.companyName,
        cart: payload.cart
    }
    // let emailBody = {
    //     amountMoney: payload.amountMoney,
    //     companyName: payload.companyName,
    //     shippingAccountNumber: payload.shippingAccountNumber,
    //     orderId: payload.orderId,
    //     buyerEmailAddress: payload.buyerEmailAddress,
    //     shippingAddress: payload.shippingAddress,
    //     cart: payload.cart
    // }
  
      const transporter = nodemailer.createTransport({
          service: 'outlook',
          secure : false,
          auth: {
            user: 'ordersatasii@outlook.com',
            pass: '92Money01'
          },
        // auth: {
        //     user: 'asiimedicalorderconfirmation@outlook.com',
        //     pass: 'asii@admin'
        //   },
          tls: {
            rejectUnauthorized: false
          }
      });

      let orderedItems = ""
      let tempCart = emailBody.cart
      tempCart.forEach(item => {
        if (item.NDCItemCode) {
            orderedItems += "<br><b>NDC Item Code: </b>" + item.NDCItemCode + " (<b>Quantity: </b>" + item.quantity + ")"
        } else {
            orderedItems += "<br><b>Item Code: </b>" + item.ItemID + " (<b>Quantity: </b>" + item.quantity + ")"
        }
      })
      
      var mailOptions = {
        from: 'ordersatasii@outlook.com',
        to: 'ordersatasii@outlook.com',
          //from: 'asiimedicalorderconfirmation@outlook.com',
          //to: 'asiimedicalorderconfirmation@outlook.com',
          subject: 'Order Submitted',
          html: //"<b>Total: $</b>" + (emailBody.amountMoney.amount).toFixed(2) / 100 + 
                "<br><br><h2>Contact Information</h2>" +
                "<br><b>Name: </b>" + emailBody.firstname + " " + emailBody.lastname +
                "<br><b>Company Name: </b>" + emailBody.companyName +
                //"<br><b>Order ID: </b>" + emailBody.orderId +
                "<br><b>Buyer Email Address: </b>" + emailBody.buyerEmailAddress +
                "<br><b>Buyer Phone Number: </b>" + emailBody.phone +
                "<br><br><h2>Cost Details</h2>" +
                "<br><b>Cart Total: </b>$" + emailBody.costDetails.cartTotal.toFixed(2) +
                "<br><b>Sales Tax: </b>%" + emailBody.costDetails.salesTax +
                "<br><b>Service Fee: </b>$" + emailBody.costDetails.serviceFee.toFixed(2) +
                "<br><b>Order Total: </b>$" + emailBody.costDetails.orderTotal.toFixed(2) +
                "<br><br><h2>Shipping Information</h2>" +
                "<br><b>Shipping Account Number: </b>" + emailBody.shippingAccountNumber + 
                "<br><b>Address: </b>" + emailBody.shippingAddress.addressLine1 +
                "<br><b>City: </b>" + emailBody.shippingAddress.locality +
                "<br><b>State: </b>" + emailBody.shippingAddress.administrativeDistrictLevel1 +
                "<br><b>Country: </b>" + emailBody.shippingAddress.country +
                "<br><b>Postal: </b>" + emailBody.shippingAddress.postalCode +
                "<br><br><u>Items Ordered:</u>" + orderedItems

    };
  
    try {
        transporter.sendMail(mailOptions, function(error, info){
            if (error) {
              console.log("HERE", error);
              res.status(500).json()
            } else {
              console.log('Email sent: ' + info.response);
              res.status(200).json()
            }
        });
    } catch (err) {
        console.log(err)
        res.status(500).json()
    }
    // // if (!validatePaymentPayload(payload)) {
    // //     throw createError(400, 'Bad Request');
    // // }

    //     try {
    //         const idempotencyKey = uuidv4()
    //         const payment = {
    //             idempotencyKey: idempotencyKey,
    //             locationId: env.LOCATION_ID,
    //             sourceId: payload.sourceId,
    //             amountMoney: payload.amountMoney,
    //             orderId: payload.orderId,
    //             buyerEmailAddress: payload.buyerEmailAddress,
    //             shippingAddress: {
    //                 addressLine1: payload.shippingAddress.addressLine1,
    //                 locality: payload.shippingAddress.locality,
    //                 administrativeDistrictLevel1: payload.shippingAddress.administrativeDistrictLevel1,
    //                 country: payload.shippingAddress.country,
    //                 postalCode: payload.shippingAddress.postalCode
    //             }
    //         };

    //         if (payload.customerId) {
    //             payment.customerId = payload.customerId;
    //         }

    //         if (payload.verificationToken) {
    //             payment.verificationToken = payload.verificationToken;
    //         }

    //         const { result } = await client.paymentsApi.createPayment(
    //             payment
    //         );

    //         res.status(200).json({
    //             success: true,
    //             payment: {
    //                 id: result.payment.id,
    //                 status: result.payment.status,
    //                 receiptUrl: result.payment.receiptUrl,
    //                 orderId: result.payment.orderId,
    //             },
    //         });

    //         //sendEmail(payload)
    //     } catch (err) {
    //        throw err
    //     }
})

// function sendEmail(payload) {
//     console.log(payload)
//     let emailBody = {
//         costDetails: payload.costDetails,
//         companyName: payload.companyName,
//         shippingAccountNumber: payload.shippingAccountNumber,
//         buyerEmailAddress: payload.buyerEmailAddress,
//         shippingAddress: payload.shippingAddress,
//         phone: payload.phone,
//         firstname: payload.firstname,
//         lastname: payload.lastname,
//         companyName: payload.companyName,
//         cart: payload.cart
//     }
//     // let emailBody = {
//     //     amountMoney: payload.amountMoney,
//     //     companyName: payload.companyName,
//     //     shippingAccountNumber: payload.shippingAccountNumber,
//     //     orderId: payload.orderId,
//     //     buyerEmailAddress: payload.buyerEmailAddress,
//     //     shippingAddress: payload.shippingAddress,
//     //     cart: payload.cart
//     // }
  
//       const transporter = nodemailer.createTransport({
//           service: 'outlook',
//           secure : false,
//         //   auth: {
//         //     user: 'ordersatasii@outlook.com',
//         //     pass: '92Money01'
//         //   },
//         auth: {
//             user: 'asiimedicalorderconfirmation@outlook.com',
//             pass: 'asii@admin'
//           },
//           tls: {
//             rejectUnauthorized: false
//           }
//       });

//       let orderedItems = ""
//       let tempCart = emailBody.cart
//       tempCart.forEach(item => {
//         orderedItems += "<br><b>NDC Item Code: </b>" + item.NDCItemCode + " (<b>Quantity: </b>" + item.quantity + ")"
//       })
      
//       var mailOptions = {
//         //   from: 'ordersatasii@outlook.com',
//         //   to: 'ordersatasii@outlook.com',
//           from: 'asiimedicalorderconfirmation@outlook.com',
//           to: 'asiimedicalorderconfirmation@outlook.com',
//           subject: 'Order Submitted',
//           html: //"<b>Total: $</b>" + (emailBody.amountMoney.amount).toFixed(2) / 100 + 
//                 "<br><br><h2>Contact Information</h2>" +
//                 "<br><b>Name: </b>" + emailBody.firstname + " " + emailBody.lastname +
//                 "<br><b>Company Name: </b>" + emailBody.companyName +
//                 //"<br><b>Order ID: </b>" + emailBody.orderId +
//                 "<br><b>Buyer Email Address: </b>" + emailBody.buyerEmailAddress +
//                 "<br><b>Buyer Phone Number: </b>" + emailBody.phone +
//                 "<br><br><h2>Cost Details</h2>" +
//                 "<br><b>Cart Total: </b>$" + emailBody.costDetails.cartTotal.toFixed(2) +
//                 "<br><b>Sales Tax: </b>%" + emailBody.costDetails.salesTax +
//                 "<br><b>Service Fee: </b>$" + emailBody.costDetails.serviceFee.toFixed(2) +
//                 "<br><b>Order Total: </b>$" + emailBody.costDetails.orderTotal.toFixed(2) +
//                 "<br><br><h2>Shipping Information</h2>" +
//                 "<br><b>Shipping Account Number: </b>" + emailBody.shippingAccountNumber + 
//                 "<br><b>Address: </b>" + emailBody.shippingAddress.addressLine1 +
//                 "<br><b>City: </b>" + emailBody.shippingAddress.locality +
//                 "<br><b>State: </b>" + emailBody.shippingAddress.administrativeDistrictLevel1 +
//                 "<br><b>Country: </b>" + emailBody.shippingAddress.country +
//                 "<br><b>Postal: </b>" + emailBody.shippingAddress.postalCode +
//                 "<br><br><u>Items Ordered:</u>" + orderedItems

//     };
  
//     try {
//         transporter.sendMail(mailOptions, function(error, info){
//             if (error) {
//               console.log("HERE", error);
//               return false
//             } else {
//               console.log('Email sent: ' + info.response);
//               return true
//             }
//         });
//     } catch (err) {
//         console.log(err)
//         return false
//     }
// }

module.exports = router;