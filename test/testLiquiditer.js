/*global describe, it, before, after*/
var assert = require('assert');
var request = require('supertest');
var async = require('async');
var _ = require('underscore');
var debug = require('debug')('testLiquiditer');
var num = require('num');
var Liquiditer = require('../lib/Liquiditer')

function getConfig(configName){
    return require('./configTest.js')(configName);
}

function startAndStop(app, cb){
    debug("STARTING")
    app.start()
    .delay(10e3)
    .then(function(){
        debug("STOPPING")
        return app.stop()
    })
    .delay(10e3)
    .then(function(){
        debug("END")
        cb()
    })
    .fail(function(error){
        log.error("startAndStop:", error)
        cb(error)
    })
}

describe('Liquiditer', function () {
    "use strict";
    
    describe('LiquiditerOk', function () {
        this.timeout(60e3)
        it('LiquiditerBitstampBTCUSD', function (done) {
            var config = getConfig('bitstampbtcusdlocal');
            var app = new Liquiditer(config);
            startAndStop(app, done);
        });
        it('LiquiditerBitfinexBTCUSD', function (done) {
            var config = getConfig('bitfinexbtcusdlocal');
            var app = new Liquiditer(config);
            startAndStop(app, done);
        });
        it('LiquiditerBitfinexLTCBTC', function (done) {
            var config = getConfig('bitfinexltcbtclocal');
            var app = new Liquiditer(config);
            startAndStop(app, done);
        });
        it('LiquiditerBitfinexDRKBTC', function (done) {
            var config = getConfig('bitfinexdrkbtclocal');
            var app = new Liquiditer(config);
            startAndStop(app, done);
        });
        it('LiquiditerBtceBTCUSD', function (done) {
            var config = getConfig('btcebtcusdlocal');
            var app = new Liquiditer(config);
            startAndStop(app, done);
        });
        it('LiquiditerBtceLTCBTC', function (done) {
            var config = getConfig('btceltcbtclocal');
            var app = new Liquiditer(config);
            startAndStop(app, done);
        });
        it('LiquiditerCryptsyDRKBTC', function (done) {
            var config = getConfig('cryptsydrkbtclocal');
            var app = new Liquiditer(config);
            startAndStop(app, done);
        });
    });
});
