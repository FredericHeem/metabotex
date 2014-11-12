/*global describe, it, before, after*/
var assert = require('assert');
var request = require('supertest');
var async = require('async');
var _ = require('underscore');
var config = require('./configTest.js')('krakenbtceurlocal');
var debug = require('debug')('Kraken');
var KrakenEx = require('../lib/Kraken');
var num = require('num');
var Utils = require('./Utils');

describe('Kraken', function () {
    "use strict";
    var api;
    
    describe('KrakenRest', function () {
        before(function(done) {
            api = new KrakenEx.RestClient(config.provider);
            api.ee().on('error', function(error){
                assert(error)
                done(error);
            });
            done()
        });
        it('KrakenBalance', function (done) {
            this.timeout(5e3)
            api.getBalances()
            .then(function(balances){
                assert(balances)
                assert(balances['BTC'])
                done();
            })
            .fail(done)
        });
        it('KrakenDepth', function (done) {
            this.timeout(5e3)
            api.getDepth("BTCEUR")
            .then(function(depth){
                assert(depth)
                assert(depth.bids[0])
                assert(depth.asks[0])
                var bid = depth.bids[0] 
                done();
            })
            .fail(done)
        });
        it('KrakenMonitorOrderBookOk', function (done) {
            this.timeout(20e3);
            var numBook = 0;
            api.ee().on('orderBook', function(depth){
                assert(depth)
                assert(depth.bids)
                assert(depth.asks);
                numBook++;
                if(numBook === 3){
                    done();
                }
            });

            api.monitorOrderBook("BTCEUR");
        });
        it('KrakenMarketsInfo', function (done) {
            this.timeout(10e3);
            
            api.fetchMarketsInfo()
            .then(function(result){
                assert(result)
                //console.log(JSON.stringify(result))
                done();
            })
            .fail(done)
        });
        it('KrakenSellLimitOk', function (done) {
            this.timeout(10e3);
            var param = {
                    market: "BTCEUR",
                    type: "ask",
                    orderType: "limit",
                    price:"500",
                    amount: "0.01"
            }
            Utils.orderAndCancel(api, param, done);
        });
        it('KrakenBuyLimitMin', function (done) {
            this.timeout(10e3);
            var param = {
                    market: "BTCEUR",
                    type: "bid",
                    orderType: "limit",
                    price:"100.11111",
                    amount: "0.009"
            }
            api.order(param)
            .fail(function(error){
                assert(error)
                console.log(JSON.stringify(error))
                done();
            })
            .fail(done)
        });
        it('KrakenBuyLimitOk', function (done) {
            this.timeout(10e3);
            var param = {
                    market: "BTCEUR",
                    type: "bid",
                    orderType: "limit",
                    price:"100.11111",
                    amount: "0.01"
            }
            Utils.orderAndCancel(api, param, done);
        });
    });
});
