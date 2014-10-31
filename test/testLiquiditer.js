/*global describe, it, before, after*/
var assert = require('assert');
var request = require('supertest');
var async = require('async');
var _ = require('underscore');
var config = require('./configTest.js')();
var debug = require('debug')('WebSocket');
var BitstampEx = require('../lib/Bitstamp');
var num = require('num');
var Liquiditer = require('../lib/Liquiditer')


describe('Liquiditer', function () {
    "use strict";
    var market = "BTCUSD";
//    describe('LiquiditerOk', function () {
//        var liquiditer = new Liquiditer(config)
//        before(function(done){
//            this.timeout(5e3)
//            liquiditer.start().then(done, done)
//        }),
//        it('LiquiditerBalances', function (done) {
//            liquiditer.getBalances()
//            .then(done)
//            .fail(done);
//        });
//        it('LiquiditerdDepth', function (done) {
//            liquiditer.getDepth(market)
//            .then(done)
//            .fail(done);
//        });
//
//    });
});
