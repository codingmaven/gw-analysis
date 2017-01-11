/**
 * Created by bosko on 10/01/17.
 */

const wapp = require('wappalyzer');
const Website = require('./models/website');
const mongoose = require('mongoose')
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

    while(true) {
        pos = string.indexOf(subString, pos);
        if (pos >= 0) {
            ++n;
            pos += step;
        } else break;
    }

    return n;
}



const analyzeWebsite = (url) => {
    return new Promise((resolve, reject) => {
        wapp.run([url, '-v', '--resource-timeout=60000'], (wappOut, wappErr) => {
            if (wappErr) {
                console.error('Error analyzing URL: ' + url + ' ' + wappErr);
                Website.findOneAndUpdate({ url: url }, {
                    $set: {
                        originalUrl: url,
                        redirectUrl: '',
                        wappErrors: wappErr,
                        checked: true,
                        software: [],
                        lastChecked: new Date().valueOf()
                    }
                }, { upsert: true }).exec().then(() => {
                    reject(wappErr.stack);
                }).catch((mongoErr) => {
                    reject(mongoErr.stack);
                });
            } else {
                if (wappOut.indexOf('\{\"url') !== -1 && occurrences(wappOut, '{\"url\"') === 1 && wappOut.indexOf('[ profiler ]') === -1) {
                    let str = wappOut.replace(/\\n/g, "\\n")
                        .replace(/\\'/g, "\\'")
                        .replace(/\\"/g, "\\'")
                        .replace(/\\&/g, "\\&")
                        .replace(/\\r/g, "\\r")
                        .replace(/\\t/g, "\\t")
                        .replace(/\\b/g, "\\b")
                        .replace(/\\f/g, "\\f");

                    str = str.replace(/[\u0000-\u0019]+/g,"");
                    let parsedwappOut = JSON.parse(wappOut);
                    console.log('analyzed ' + parsedwappOut.url)

                    Website.findOneAndUpdate({ url: url }, {
                        $set: {
                            originalUrl: parsedwappOut.originalUrl,
                            software: parsedwappOut.applications,
                            redirectUrl: (_.isEqual(parsedwappOut.url, url) ? '' : parsedwappOut.url),
                            lastChecked: new Date().valueOf(),
                            checked: true
                        }
                    }, { upsert: true }).exec().then(() => {
                        resolve();
                    }).catch((mongoErr) => {
                        console.err(mongoErr.stack)
                        reject(mongoErr);
                    })
                } else if (wappOut.indexOf('\{\"url') !== -1 && occurrences(wappOut, '{\"url\"') > 1 && wappOut.indexOf('[ profiler ]') === -1) {
                    let strs = wappOut.split('{\"url\"');
                    wappOut = '{\"url\"' + strs[1];
                    let str = wappOut.replace(/\\n/g, "\\n")
                        .replace(/\\'/g, "\\'")
                        .replace(/\\"/g, "\\'")
                        .replace(/\\&/g, "\\&")
                        .replace(/\\r/g, "\\r")
                        .replace(/\\t/g, "\\t")
                        .replace(/\\b/g, "\\b")
                        .replace(/\\f/g, "\\f");
                    // remove non-printable and other non-valid JSON chars
                    str = str.replace(/[\u0000-\u0019]+/g,"");
                    let parsedwappOut = JSON.parse(wappOut);
                    console.log('analyzed ' + parsedwappOut.url)
                    // wappOut.applications = JSON.parse(wappOut.applications)
                    Website.findOneAndUpdate({ url: url }, {
                        $set: {
                            originalUrl: parsedwappOut.originalUrl,
                            software: parsedwappOut.applications,
                            redirectUrl: (_.isEqual(parsedwappOut.url, url) ? '' : parsedwappOut.url),
                            lastChecked: new Date().valueOf(),
                            checked: true
                        }
                    }, { upsert: true }).exec().then(() => {
                        resolve();
                    }).catch((mongoErr) => {
                        console.err(mongoErr.stack)
                        reject(mongoErr);
                    })
                } else {
                    resolve()
                    // console.log('wappOut not json: ' + wappOut)
                    /* Website.findOneAndUpdate({ url: url }, {
                        $set: {
                            originalUrl: url,
                            software: [],
                            redirectUrl: (_.isEqual(wappOut.url, url) ? '' : wappOut.url),
                            lastChecked: new Date().valueOf(),
                            checked: true,
                            errors: wappOut
                        }
                    }, { upsert: true }).exec().then(() => {
                        resolve();
                    }).catch((mongoErr) => {
                        reject(mongoErr);
                    }) */
                }
            }
        });
    })
};

const analyzeChunk = () => {
    return new Promise((resolve, reject) => {
        Website.find({ checked: false }, (err, websites) => {
            let urls = _.reduce(websites, (result, website) => {
                result.push(website.url);
                return result;
            }, []);

            let promises = Promise.all(urls.map(analyzeWebsite));
            promises.then(() => {
                console.log('analyzed');
                resolve()
            }).catch((err) => {
                console.err(err.stack)
                reject(err)
            })
        }).limit(20)
    })
};


connectDb().then(() => {
    analyzeChunk().then(() => {
        console.log('analyzed 2')
    })
})