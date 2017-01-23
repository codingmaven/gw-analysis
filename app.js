var express = require('express');
var path = require('path');
var favicon = require('serve-favicon');
var logger = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');

var index = require('./routes/index');
var users = require('./routes/users');

var app = express();

const _ = require('lodash')

let mongoose = require('mongoose');
mongoose.Promise = global.Promise;
const Website = require('./models/website');

const wapp = require('wappalyzer');
const fs = require('fs');
const cluster = require('cluster');


const connectDb = () => {
  let mongodbUrl = 'mongodb://localhost/websoftanalyzer';
  return mongoose.connect(mongodbUrl, {
    server: {
      poolSize: 20,
        reconnectTries: 30,
        socketOptions: {
          autoReconnect: true,
          keepAlive: 0,
          connectTimeoutMS: 0,
          socketTimeoutMS: 0
        }
    }
  })
};

const analyzeWebsite = (url) => {
  return new Promise((resolve, reject) => {
      wapp.run([url, '-v'], (wappOut, wappErr) => {
          if (wappErr && !wappOut) {
              console.error('Error analyzing URL: ' + url + ' ' + JSON.stringify(wappErr));
              Website.findOneAndUpdate({ url: url }, {
                  $set: {
                      originalUrl: url,
                      redirectUrl: '',
                      wappErrors: wappErr,
                      checked: true,
                      lastChecked: new Date().valueOf()
                  }
              }, { upsert: true }).then(() => {
                    reject(wappErr);
                  }).catch((mongoErr) => {
                    reject(mongoErr);
                });
          } else {
              Website.findOneAndUpdate({ url: url }, {
                  $set: {
                      originalUrl: wappOut.originalUrl,
                      software: wappOut.applications,
                      redirectUrl: (_.isEqual(wappOut.url, url) ? '' : wappOut.url),
                      lastChecked: new Date().valueOf(),
                      checked: true
                  }
              }, { upsert: true }).then(() => {
                  resolve();
              }).catch((mongoErr) => {
                  reject(mongoErr);
              })
          }
      });
  })
};

connectDb().then(() => {
    analyzeWebsite('http://innovationelectric.com').then(() => {
        console.log('Analyzed suelong.com')
    }).catch((err) => {
        console.error(err)
    })
})


// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'hbs');

// uncomment after placing your favicon in /public
//app.use(favicon(path.join(__dirname, 'public', 'favicon.ico')));
app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/', index);
app.use('/users', users);

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  var err = new Error('Not Found');
  err.status = 404;
  next(err);
});

// error handler
app.use(function(err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render('error');
});

module.exports = app;
