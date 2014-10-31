/*global describe, it, before, after*/
var assert = require('assert');
var request = require('supertest');
var async = require('async');
var _ = require('underscore');
var config = require('./configTest.js')('bitfinexbtcusdlocal');
var debug = require('debug')('Airbex');
var BitfinexEx = require('../lib/Bitfinex');
var num = require('num');

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
                if(numBook === 3){
                    done();
                }
            });

            api.monitorOrderBook("BTCUSD");
        });
        
    });
});
