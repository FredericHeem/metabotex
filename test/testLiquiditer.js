/*global describe, it, before, after*/
var assert = require('assert');
var request = require('supertest');
var async = require('async');
var _ = require('underscore');
var debug = require('debug')('testLiquiditer');
var num = require('num');
var Liquiditer = require('../lib/Liquiditer')
var fs = require('fs');
var Airbex = require('airbex-client');
var log = require('../lib/log')(__filename)
, debug = log.debug

function getConfig(configName){
    return require('./configTest.js')(configName);
}

function startTradeStop(app, orderParam, cb){
    debug("STARTING");
    var traderConfig = (JSON.parse(fs.readFileSync("test/config/trader.json", "utf8")));
    var trader = new Airbex.RestClient(traderConfig);
    app.start()
    .delay(4e3)
    .then(function(){
        log.info("order ", orderParam)
        return trader.order(orderParam)
    })
    .delay(5e3)
    .then(function(){
        debug("STOPPING")
        return app.stop()
    })
    .delay(2e3)
    .then(function(){
        debug("END")
        cb()
    })
    .fail(function(error){
        log.error("startAndStop:", error)
        cb(error)
    })
}

function startAndStop(app, cb){
    debug("STARTING")
    app.start()
    .delay(10e3)
    .then(function(){
        debug("STOPPING")
        return app.stop()
    })
    .delay(2e3)
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
        this.timeout(20e3)
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
//        it('LiquiditerBtceBTCUSD', function (done) {
//            var config = getConfig('btcebtcusdlocal');
//            var app = new Liquiditer(config);
//            startAndStop(app, done);
//        });
        it('LiquiditerBtceLTCBTC', function (done) {
            var config = getConfig('btceltcbtclocal');
            var app = new Liquiditer(config);
            startAndStop(app, done);
        });
        it('LiquiditerCryptsyDOGEBTC', function (done) {
            var config = getConfig('cryptsydogebtclocal');
            var app = new Liquiditer(config);
            startAndStop(app, done);
        });
    });
    describe('TradeOk', function () {
        this.timeout(20e3)
        it('LiquiditerOrderBitstampBuyBTCUSD', function (done) {
            var config = getConfig('bitstampbtcusdlocal');
            var app = new Liquiditer(config);
            
            var orderParam = {
                market: "BTCUSD",
                type: "bid",
                price:"500",
                amount: "0.001"
            }
            startTradeStop(app, orderParam, done);
        });
        it('LiquiditerOrderBitstampSellBTCUSD', function (done) {
            var config = getConfig('bitstampbtcusdlocal');
            var app = new Liquiditer(config);
            
            var orderParam = {
                market: "BTCUSD",
                type: "ask",
                price:"200",
                amount: "0.001"
            }
            startTradeStop(app, orderParam, done);
        });
        it('LiquiditerOrderBitfinexBuyLTCBTC', function (done) {
            var config = getConfig('bitfinexltcbtclocal');
            var app = new Liquiditer(config);
            
            var orderParam = {
                market: "LTCBTC",
                type: "bid",
                price:"0.03",
                amount: "0.001"
            }
            startTradeStop(app, orderParam, done);
        });
        it('LiquiditerOrderBitfinexSellLTCBTC', function (done) {
            var config = getConfig('bitfinexltcbtclocal');
            var app = new Liquiditer(config);
            
            var orderParam = {
                market: "LTCBTC",
                type: "ask",
                price:"0.005",
                amount: "0.001"
            }
            startTradeStop(app, orderParam, done);
        });
        it('LiquiditerOrderBitfinexBuyDRKBTC', function (done) {
            var config = getConfig('bitfinexdrkbtclocal');
            var app = new Liquiditer(config);
            
            var orderParam = {
                market: "DRKBTC",
                type: "bid",
                price:"0.01",
                amount: "0.001"
            }
            startTradeStop(app, orderParam, done);
        });
        it('LiquiditerOrderBitfinexSellDRKBTC', function (done) {
            var config = getConfig('bitfinexdrkbtclocal');
            var app = new Liquiditer(config);
            
            var orderParam = {
                market: "DRKBTC",
                type: "ask",
                price:"0.001",
                amount: "0.001"
            }
            startTradeStop(app, orderParam, done);
        });
        it('LiquiditerOrderBitfinexBuyBTCUSD', function (done) {
            var config = getConfig('bitfinexbtcusdlocal');
            var app = new Liquiditer(config);
            
            var orderParam = {
                market: "BTCUSD",
                type: "bid",
                price:"500",
                amount: "0.001"
            }
            startTradeStop(app, orderParam, done);
        });
        it('LiquiditerOrderBitfinexSellBTCUSD', function (done) {
            var config = getConfig('bitfinexbtcusdlocal');
            var app = new Liquiditer(config);
            
            var orderParam = {
                market: "BTCUSD",
                type: "ask",
                price:"200",
                amount: "0.001"
            }
            startTradeStop(app, orderParam, done);
        });
        it('LiquiditerOrderBtceBuyLTCBTC', function (done) {
            var config = getConfig('btceltcbtclocal');
            var app = new Liquiditer(config);
            
            var orderParam = {
                market: "LTCBTC",
                type: "bid",
                price:"0.02",
                amount: "0.01"
            }
            startTradeStop(app, orderParam, done);
        });
        it('LiquiditerOrderBtceSellLTCBTC', function (done) {
            var config = getConfig('btceltcbtclocal');
            var app = new Liquiditer(config);
            
            var orderParam = {
                market: "LTCBTC",
                type: "ask",
                price:"0.005",
                amount: "0.01"
            }
            startTradeStop(app, orderParam, done);
        });
        it('LiquiditerOrderKrakenBuyBTCEUR', function (done) {
            var config = getConfig('krakenbtceurlocal');
            var app = new Liquiditer(config);
            
            var orderParam = {
                market: "BTCEUR",
                type: "bid",
                price:"400",
                amount: "0.001"
            }
            startTradeStop(app, orderParam, done);
        });
        it('LiquiditerOrderKrakenSellBTCEUR', function (done) {
            var config = getConfig('krakenbtceurlocal');
            var app = new Liquiditer(config);
            
            var orderParam = {
                market: "BTCEUR",
                type: "ask",
                price:"200",
                amount: "0.001"
            }
            startTradeStop(app, orderParam, done);
        });
    });
});
