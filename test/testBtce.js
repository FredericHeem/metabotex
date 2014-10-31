/*global describe, it, before, after*/
var assert = require('assert');
var request = require('supertest');
var async = require('async');
var _ = require('underscore');
var config = require('./configTest.js')('btcebtcusdlocal');
var debug = require('debug')('Btce');
var BtceEx = require('../lib/Btce');
var num = require('num');

describe('Btce', function () {
    "use strict";
    var apirest;
    
    describe('BtceRest', function () {
        before(function(done) {
            apirest = new BtceEx.RestClient(config.provider);
            apirest.ee().on('error', function(error){
                assert(error)
                done(error);
            });
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
                if(numBook === 3){
                    done();
                }
            });

            apirest.monitorOrderBook("BTCUSD");
        });
    });
});
