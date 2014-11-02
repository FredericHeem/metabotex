/*global describe, it, before, after*/
var assert = require('assert');
var request = require('supertest');
var async = require('async');
var _ = require('underscore');
var debug = require('debug')('WebSocket');
var num = require('num');
var Liquiditer = require('../lib/Liquiditer')

function getConfig(configName){
    return require('./configTest.js')(configName);
}

function startAndStop(app, cb){
    app.start()
    .then(function(){
        setTimeout(function(){
            app.stop()
            .then(cb)
            .fail(cb)
        }, 10e3)
    })
}

describe('Liquiditer', function () {
    "use strict";
    
    describe('LiquiditerKo', function () {
        this.timeout(60e3)
        it('LiquiditerUnmonitor', function (done) {
            var config = getConfig('bitfinexbtcusdlocal');
            var app = new Liquiditer(config);
            app.start()
            .then(function(){
                setTimeout(function(){
                    console.log("STOP starts")
                    app.stop()
                    .then(function(){
                        console.log("STOP ends")
                        setTimeout(function(){
                            console.log("END")
                            done()
                        }, 10e3)
                    })
                    .fail(done)
                }, 5e3)
            })
        });
        
    });
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
    });
});
