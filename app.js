'use strict';

//configurations
const path = require('path');
const express = require('express');
const cookieParser = require('cookie-parser');
const bodyParser = require('body-parser');
const jsonResponse = require('./utils/json-response');
const errors = require('./utils/dz-errors');
const cors = require('cors');
const config = require('./config');

const mongoose = require('mongoose');
mongoose.connect(config.database_url, {useNewUrlParser: true, useUnifiedTopology:true, useCreateIndex:true}).then((result) => {
    console.log("Database connected successfully")
}).catch((error) => {
    console.log(error)
});

//routes
const routes = require('./routes/index');
const auth = require('./routes/auth');
const dashboard = require('./routes/dashboard');
const user = require('./routes/user');
const loginLog = require('./routes/login-log');
const customer = require('./routes/customer');
const vehicle = require('./routes/vehicle');
const provider = require('./routes/provider');
const deliveryOption = require('./routes/delivery-option');
const price = require('./routes/price');
const settings = require('./routes/settings');
const email = require('./routes/email');
const push = require('./routes/push');
const faqCategory = require('./routes/faq-category');
const faq = require('./routes/faq');
const cms = require('./routes/cms');
const coupon = require('./routes/coupon');
const job = require('./routes/job');
const role = require('./routes/role');
const region = require('./routes/region');
const status = require('./routes/status');
const company = require('./routes/company');

//other configurations
const passport = require('passport');
const favicon = require('serve-favicon');
const multiparty = require('connect-multiparty');
const upload = require('express-fileupload');
const multipartyMiddleWare = multiparty();

//express configurations
const app = express();
app.use(favicon(path.join(__dirname, './public/img', 'favicon.ico')));
app.use(express.static(path.join(__dirname, 'public')));
app.use(bodyParser.json({limit: '50mb'}));
app.use(bodyParser.urlencoded({extended: true, limit: '50mb'}));
app.use(cookieParser());
app.use(require('express-session')({
    secret: 'keyboard cat',
    resave: false,
    saveUninitialized: false
}));
app.use(cors());
app.use(passport.initialize());
app.use(passport.session());
app.use(multipartyMiddleWare);
const responseCodes = require('./utils/response-codes');

// import routes
app.use('/',routes);
app.use('/api/auth', auth);
app.use('/api/dashboard', dashboard);
app.use('/api/user', user);
app.use('/api/login-log', loginLog);
app.use('/api/customer', customer);
app.use('/api/vehicle', vehicle);
app.use('/api/provider', provider);
app.use('/api/delivery-option', deliveryOption);
app.use('/api/vehicle-price', price);
app.use('/api/settings', settings);
app.use('/api/email', email);
app.use('/api/push', push);
app.use('/api/faq-category', faqCategory);
app.use('/api/faq', faq);
app.use('/api/cms', cms);
app.use('/api/coupon', coupon);
app.use('/api/job', job);
app.use('/api/role', role);
app.use('/api/region', region);
app.use('/api/status', status);
app.use('/api/company', company);
app.use('/api/head-quarter', require('./routes/petrol-modules/head-quarter'));
app.use('/api/branch', require('./routes/petrol-modules/branch'));
app.use('/api/rider', require('./routes/petrol-modules/rider'));
app.use('/api/kijiwe', require('./routes/petrol-modules/kijiwe'));

app.use(upload());

var swaggerUi = require("swagger-ui-express"),
swaggerDocument = require("./swagger.json");

app.use("/api-swagger", swaggerUi.serve, swaggerUi.setup(swaggerDocument));

app.use((req, res) => {
	console.log('\nError: No route found or Wrong method name');
	jsonResponse(res, errors("No route found or Wrong method name", responseCodes.Forbidden), null);
});

app.use((err, req, res) => {
	res.status(err.status || 500);
	res.render('error', {
	message: err.message,
		error: {}
	});
});

module.exports = app;