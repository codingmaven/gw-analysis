/**
 * Created by bosko on 10/01/17.
 */

const mongoose = require('mongoose');
const csvparser = require('fast-csv');
const _ = require('lodash');
const fs = require('fs');
const Website = require('./models/website');
let stream = fs.createReadStream('./csv/urls.csv');

const parseCsv = () => {
    let mongodbUrl = 'mongodb://localhost/websoftanalyzer';

    return new Promise((resolve, reject) => {
        mongoose.connect(mongodbUrl, {
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
        }).then(() => {
            let parser = csvparser()
                .on('data', (data) => {
                    let trimmed = _.without(data, '');
                    Website.collection.insert({
                        url: trimmed[0],
                        checked: false,
                        software: []
                    }, (err, res) => {
                        console.log(err || 'Parsed website: ' + trimmed[0]);
                    })
                }).on('error', (err) => {
                    reject('Error processing CSV: ' + err.stack);
                }).on('end', () => {
                    parser.end();
                    resolve('Parsing done!');
                });

            stream.pipe(parser);
        }).catch((err) => {
            console.error('Failed to process CSV: ' + err.stack);
            reject(err);
        })
    })
};

parseCsv().then(() => {
    console.log('Parsed csv')
}).catch((err) => {
    console.error('error parsing csv: ' + err)
})