/**
 * Created by bosko on 10/01/17.
 */

const co = require('co');
const cluster = require('cluster');
const wapp = require('wappalyzer');
const Website = require('./models/website');
const mongoose = require('mongoose')
const sleep = require('sleep');
mongoose.Promise = global.Promise;

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

const _ = require('lodash');

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

const analyzeWebsite = (url) => {
  return new Promise((resolve, reject) => {
    wapp.run([url, '-v', '--resource-timeout=60000'], (wappOut, wappErr) => {
      sleep.msleep(100);
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
        }, {upsert: true}).exec().then(() => {
          reject(wappErr.stack);
        }).catch((mongoErr) => {
          reject(mongoErr.stack);
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
          }, {upsert: true}).exec().then(() => {
            resolve();
          }).catch((mongoErr) => {
            console.err(mongoErr.stack)
            reject(mongoErr);
          })
        } else {
          resolve();
        }
      }
    });
  })
};

connectDb().then(() => {
  var cursor = Website.find({checked: false}).lean().cursor();

  cursor.on('data', (doc) => {
    sleep.msleep(100);
    analyzeWebsite(doc.url).then(() => {
      console.log('Analyzed ' + doc.url);
    }).catch((err) => {
      console.error('Failed to analyze ' + doc.url);
    })
  });
})

