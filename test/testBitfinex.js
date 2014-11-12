/*global describe, it, before, after*/
var assert = require('assert');
var request = require('supertest');
var async = require('async');
var _ = require('underscore');
var config = require('./configTest.js')('bitfinexbtcusdlocal');
var debug = require('debug')('Airbex');
var BitfinexEx = require('../lib/Bitfinex');
var num = require('num');
var Utils = require('./Utils');

describe('Bitfinex', function () {
    "use strict";
    var api;
    
    describe('BitfinexRest', function () {
        before(function(done) {
            api = new BitfinexEx.RestClient(config.provider);
            api.ee().on('error', function(error){
                assert(error)
                done(error);
            });
            done()
        });
        it('BitfinexBalance', function (done) {
            api.getBalances()
            .then(function(balances){
                assert(balances)
                assert(balances['BTC'])
                done();
            })
            .fail(done)
        });
        it('BitfinexDepth', function (done) {
            api.getDepth("BTCUSD")
            .then(function(depth){
                assert(depth)
                assert(depth.bids)
                assert(depth.asks)
                done();
            })
            .fail(done)
        });
        it('BitfinexMonitorOrderBookOk', function (done) {
            this.timeout(20e3);
            var numBook = 0;
            api.ee().on('orderBook', function(depth){
                assert(depth)
                assert(depth.bids)
                assert(depth.asks);
                numBook++;
                if(numBook === 2){
                    done();
                }
            });

            api.monitorOrderBook("BTCUSD");
        });
        it('BitfinexSellLimitOk', function (done) {
            this.timeout(10e3);
            var param = {
                    market: "BTCUSD",
                    type: "ask",
                    orderType: "limit",
                    price:"500",
                    amount: "0.01"
            }
            Utils.orderAndCancel(api, param, done);
        });
        it('BitfinexBuyLimitOk', function (done) {
            this.timeout(10e3);
            var param = {
                    market: "BTCUSD",
                    type: "bid",
                    orderType: "limit",
                    price:"100.11111",
                    amount: "0.01"
            }
            Utils.orderAndCancel(api, param, done);
        });
        it('BitfinexBuyLimitMin', function (done) {
            this.timeout(10e3);
            var param = {
                    market: "BTCUSD",
                    type: "bid",
                    orderType: "limit",
                    price:"100.11111",
                    amount: "0.001"
            }
            api.order(param)
            .fail(function(error){
                assert(error)
                console.log(JSON.stringify(error))
                done();
            })
            .fail(done)
        });
    });
});
