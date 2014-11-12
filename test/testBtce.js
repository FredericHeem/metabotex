/*global describe, it, before, after*/
var assert = require('assert');
var request = require('supertest');
var async = require('async');
var _ = require('underscore');
var config = require('./configTest.js')('btcebtcusdlocal');
var debug = require('debug')('Btce');
var BtceEx = require('../lib/Btce');
var num = require('num');
var Utils = require('./Utils');

describe('Btce', function () {
    "use strict";
    var apirest;
    
    describe('BtceRest', function () {
        var apirest;
        before(function(done) {
            apirest = new BtceEx.RestClient(config.provider);
            apirest.ee().on('error', function(error){
                assert(error)
                done(error);
            });
            done()
        });
        after(function(done) {
            apirest.unmonitorOrderBook()
            done()
        });
        it('BtceBalance', function (done) {
            apirest.getBalances()
            .then(function(balances){
                assert(balances)
                assert(balances['BTC'])
                done();
            })
            .fail(done)
        });
        it('BtceDepthBTCUSD', function (done) {
            apirest.getDepth("BTCUSD")
            .then(function(depth){
                assert(depth)
                assert(depth.bids)
                assert(depth.asks)
                done();
            })
            .fail(done)
        });
        it('BtceMonitorOrderBookOk', function (done) {
            this.timeout(20e3);
            var numBook = 0;
            apirest.ee().on('orderBook', function(depth){
                assert(depth)
                assert(depth.bids)
                assert(depth.asks);
                numBook++;
                if(numBook === 2){
                    done();
                }
            });

            apirest.monitorOrderBook("BTCUSD");
        });
        
        it('BtceSellLimitOkBTCUSD', function (done) {
            this.timeout(10e3);
            var param = {
                    market: "BTCUSD",
                    type: "ask",
                    orderType: "limit",
                    price:"500",
                    amount: "0.01"
            }
            Utils.orderAndCancel(apirest, param, done);
        });
        it('BtceBuyLimitOkBTCUSD', function (done) {
            this.timeout(10e3);
            var param = {
                    market: "BTCUSD",
                    type: "bid",
                    orderType: "limit",
                    price:"100.11",
                    amount: "0.01"
            }
            Utils.orderAndCancel(apirest, param, done);
        });
        
        it('BtceBuyLimitMin', function (done) {
            this.timeout(10e3);
            var param = {
                    market: "BTCUSD",
                    type: "bid",
                    orderType: "limit",
                    price:"100.11111",
                    amount: "0.001"
            }
            apirest.order(param)
            .fail(function(error){
                assert(error)
                console.log(JSON.stringify(error))
                done();
            })
            .fail(done)
        });
        it('BtceButLimitOkLTCBTC', function (done) {
            this.timeout(10e3);
            var param = {
                    market: "LTCBTC",
                    type: "bid",
                    orderType: "limit",
                    price:"0.005",
                    amount: "0.1"
            }
            Utils.orderAndCancel(apirest, param, done);
        });
    });
});
