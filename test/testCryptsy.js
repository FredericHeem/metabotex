/*global describe, it, before, after*/
var assert = require('assert');
var request = require('supertest');
var async = require('async');
var _ = require('underscore');
var config = require('./configTest.js')('cryptsydogebtclocal');
var debug = require('debug')('Cryptsy');
var CryptsyEx = require('../lib/Cryptsy');
var num = require('num');

describe('Cryptsy', function () {
    "use strict";
    var api;
    
    describe('CryptsyRest', function () {
        before(function(done) {
            api = new CryptsyEx.RestClient(config.provider);
            api.ee().on('error', function(error){
                assert(error)
                done(error);
            });
            done()
        });
        it('CryptsyBalance', function (done) {
            api.getBalances()
            .then(function(balances){
                assert(balances)
                assert(balances['BTC'])
                done();
            })
            .fail(done)
        });
        it('CryptsyDepth', function (done) {
            api.getDepth("DRKBTC")
            .then(function(depth){
                assert(depth)
                assert(depth.bids[0])
                assert(depth.asks[0])
                var bid = depth.bids[0] 
                done();
            })
            .fail(done)
        });
        it('CryptsyMonitorOrderBookOk', function (done) {
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

            api.monitorOrderBook("DRKBTC");
        });
        
    });
});
