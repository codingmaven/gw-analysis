/**
 * Created by bosko on 10/01/17.
 */

const co = require('co');
const cluster = require('cluster');
const wapp = require('wappalyzer');
const Website = require('./models/website');
const mongoose = require('mongoose')
const sleep = require('sleep');
const async = require('async');
const _ = require('lodash');
mongoose.Promise = global.Promise;

const connectDb = () => {
  let mongodbUrl = 'mongodb://localhost/websoftanalyzer';
  return mongoose.connect(mongodbUrl, {
    server: {
      poolSize: 20,
      reconnectTries: 30,
      socketOptions: {
        autoReconnect: true,
        keepAlive: 30000,
        connectTimeoutMS: 300000,
        socketTimeoutMS: 300000
      }
    }
  })
};

const occurrences = (string, subString, allowOverlapping) => {
  string += "";
  subString += "";
  if (subString.length <= 0) {
    return string.length + 1;
  }

  var n = 0, pos = 0, step = allowOverlapping ? 1 : subString.length;

  while (true) {
    pos = string.indexOf(subString, pos);
    if (pos >= 0) {
      ++n;
      pos += step;
    } else break;
  }

  return n;
}

const tryParseJSON = (jsonString) => {
  try {
    var o = JSON.parse(jsonString);

    if (typeof o.url === 'undefined')
      return false;

    if (o && typeof o === "object") {
      return o;
    }
  }
  catch (e) {
  }

  return false;
};

const analyzeWebsite = (url, callback) => {
  callback = _.once(callback);
  wapp.run([url, '-v', '--resource-timeout=60000'], (wappOut, wappErr) => {
    if (wappErr) {
      console.error('Error analyzing URL: ' + url + ' ' + wappErr);
      Website.findOneAndUpdate({url: url}, {
        $set: {
          originalUrl: url,
          redirectUrl: '',
          wappErrors: wappErr,
          checked: true,
          software: [],
          lastChecked: new Date().valueOf()
        }
      }, {upsert: true}, (err, res) => {
        if (err) {
          callback(err);
        } else {
          callback(null, url);
        }
      });
    } else {
      if (tryParseJSON(wappOut)) {
        let str = wappOut.replace(/\\n/g, "\\n")
          .replace(/\\'/g, "\\'")
          .replace(/\\"/g, "\\'")
          .replace(/\\&/g, "\\&")
          .replace(/\\r/g, "\\r")
          .replace(/\\t/g, "\\t")
          .replace(/\\b/g, "\\b")
          .replace(/\\f/g, "\\f");

        str = str.replace(/[\u0000-\u0019]+/g, "");
        let parsedwappOut = JSON.parse(wappOut);
        console.log('analyzed ' + parsedwappOut.url)

        Website.findOneAndUpdate({url: url}, {
          $set: {
            originalUrl: parsedwappOut.originalUrl,
            software: parsedwappOut.applications,
            redirectUrl: (_.isEqual(parsedwappOut.url, url) ? '' : parsedwappOut.url),
            lastChecked: new Date().valueOf(),
            checked: true
          }
        }, {upsert: true}, (err, res) => {
          if (err) {
            callback(err);
          } else {
            callback(null, JSON.stringify(parsedwappOut));
          }
        })
      } else {
        callback(null, url);
      }
    }
  });
};

connectDb().then(() => {
  console.log('Connected to Database');
  var cursor = Website.find({checked: false}).lean().cursor();
  var q = async.queue((task, callback) => {
    analyzeWebsite(task, (err, res) => {
      callback(err, res);
    })
  }, 10);

  q.drain = () => {
    console.log('Queue drained');
  };

  cursor.on('data', (doc) => {
    q.push(doc.url, (err, res) => {
      if (err) {
        console.error(err);
      } else {
        console.log('Analyzed ' + res);
      }
    });
  });
});

