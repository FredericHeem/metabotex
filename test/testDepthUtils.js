/*global describe, it, before, after*/
var assert = require('assert');
var request = require('supertest');
var async = require('async');
var _ = require('underscore');
var config = require('./configTest.js')();
var debug = require('debug')('DepthUtils');
var DepthUtil = require('../lib/DepthUtils');
var num = require('num');

describe('DepthUtils', function () {
    "use strict";
    
    describe('getAmountBaseFromQuote', function () {

        it('getAmountBaseFromQuote1', function (done) {
            var asks = [["500", "0.1"]];
            var balanceQc = "1000";
            assert(num(DepthUtil.getAmountBaseFromQuote(balanceQc, asks)).eq("0.1"));
            done();
        });
        it('getAmountBaseFromQuote2', function (done) {
            var asks = [["250", "0.1"], ["500", "0.1"]];
            var balanceQc = "1000";
            assert(num(DepthUtil.getAmountBaseFromQuote(balanceQc, asks)).eq("0.2"));
            done();
        });
        it('getAmountBaseFromQuote3', function (done) {
            var asks = [["500", "1"], ["1000", "2"]];
            var balanceQc = "1000";
            console.log(DepthUtil.getAmountBaseFromQuote(balanceQc, asks))
            assert(num(DepthUtil.getAmountBaseFromQuote(balanceQc, asks)).eq("1.5"));
            done();
        });
        it('getAmountBaseFromQuote4', function (done) {
            var asks = [];
            var balanceQc = "1000";
            console.log(DepthUtil.getAmountBaseFromQuote(balanceQc, asks))
            assert(num(DepthUtil.getAmountBaseFromQuote(balanceQc, asks)).eq("0"));
            done();
        });
        it('getAmountBaseFromQuote5', function (done) {
            var asks = [["500", "1"], ["1000", "1"], ["1100", "0.2"]];
            var balanceQc = "1000";
            assert(num(DepthUtil.getAmountBaseFromQuote(balanceQc, asks)).eq("1.5"));
            done();
        });
    });
    describe('filterWithAmount', function () {

        it('filterWithAmount1', function (done) {
            var asks = [["500", "1"]];
            var balanceBc = "0.5";
            var result = [["500", "0.5"]];
            assert(_.isEqual(DepthUtil.filterWithAmount(balanceBc, asks), result));
            done();
        });
        it('filterWithAmount2', function (done) {
            var asks = [["500", "1"]];
            var balanceBc = "2";
            var result = [["500", "1"]];
            assert(_.isEqual(DepthUtil.filterWithAmount(balanceBc, asks), result));
            done();
        });
        it('filterWithAmount3', function (done) {
            var asks = [["500", "1"], ["600", "1"]];
            var balanceBc = "1.5";
            var result = [["500", "1"], ["600", "0.5"]];
            assert(_.isEqual(DepthUtil.filterWithAmount(balanceBc, asks), result));
            done();
        });
        it('filterWithAmount4', function (done) {
            var asks = [["500", "1"], ["600", "1"]];
            var balanceBc = "3";
            var result = [["500", "1"], ["600", "1"]];
            assert(_.isEqual(DepthUtil.filterWithAmount(balanceBc, asks), result));
            done();
        });
    });
    describe('addFees', function () {

        it('addFees', function (done) {
            var asks = [["500", "1"]];
            var fee = "2";
            var result = [["510.00000", "1"]];
            console.log(DepthUtil.addFees(asks, fee))
            assert(_.isEqual(DepthUtil.addFees(asks, fee), result));
            done();
        });
       
    });
});
