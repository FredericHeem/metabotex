/*global describe, it, before, after*/
var assert = require('assert');
var request = require('supertest');
var async = require('async');
var _ = require('underscore');
var config = require('./configTest.js')('bitstampbtcusdlocal');
var debug = require('debug')('Airbex');
var AirbexEx = require('../lib/Airbex');
var num = require('num');

describe('Airbex', function () {
    "use strict";
    var api;
    
    describe('AirbexRest', function () {
        before(function(done) {
            api = new AirbexEx.RestClient(config.target);
            api.ee().on('error', function(error){
                assert(error)
                done(error);
            });
            done()
        });
        it('AirbexBalance', function (done) {
            api.getBalances()
            .then(function(balances){
                assert(balances)
                assert(balances['BTC'])
                done();
            })
            .fail(done)
        });
        it('AirbexCurrencies', function (done) {
            api.fetchCurrencies()
            .then(function(currencies){
                assert(currencies)
                assert(currencies['BTC'])
                done();
            })
            .fail(done)
        });
        it('AirbexMarketsInfo', function (done) {
            api.fetchMarketsInfo()
            .then(function(marketsInfo){
                assert(marketsInfo)
                assert(marketsInfo['BTCUSD'])
                done();
            })
            .fail(done)
        });
    });
});
