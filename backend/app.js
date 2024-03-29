const bodyParser = require('body-parser');
const express = require('express');
const mongoose = require('mongoose');
const env = require('../environment.js')

const productsRoutes = require('./routes/products')
const smallQuantityProductsRoutes = require('./routes/smallQuantityProducts')

const app = express();

mongoose.connect(env.db_connection_string, {useNewURLParser: true})
    .then(() => {
        console.log('Connected to database.')
    })
    .catch((err) => {
        console.log(err)
        console.log('Connection failed.')
    })

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: false}));

app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 
                  'Origin, X-Requested-With, Content-Type, Accept');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
    next();
})

app.use("/api/products", productsRoutes)
app.use("/api/smallQuantityProducts", smallQuantityProductsRoutes)


module.exports = app;