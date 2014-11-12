/*global describe, it, before, after*/
var assert = require('assert');
var request = require('supertest');
var async = require('async');
var _ = require('underscore');
var config = require('./configTest.js')('bitstampbtcusdlocal');
var debug = require('debug')('WebSocket');
var BitstampEx = require('../lib/Bitstamp');
var num = require('num');
var Utils = require('./Utils');

function totalBidAsk(bidasks){
    var total = num(0);
    bidasks.forEach(function(bidask){
        total = total.add(bidask[1])
    })
    return total.toString()
}

describe('Bitstamp', function () {
    "use strict";
    
    describe('BitstampWebSocket', function () {
        var apiws;
        before(function(done) {
            this.timeout(5e3)
            apiws = new BitstampEx.WebSocketClient(config.provider);
            apiws.start()
            .then(function(){
                debug("started");
                apiws.monitorOrderBook();
                done();
            })
            .fail(done);
            
        });
        after(function(done) {
            apiws.stop();
            done();
        });
        it('BitstampOrderBookPartial', function (done) {
            this.timeout(30e3);
            var numOps = 0;
            console.log("BitstampOrderBookPartial start:")
            apiws.ee().on("orderBook", function(orderBook){
                assert(orderBook);
                console.log("orderBook:")
                //console.log(JSON.stringify(orderBook));
                console.log("total bids: ", totalBidAsk(orderBook.bids));
                console.log("total asks: ", totalBidAsk(orderBook.asks));
                numOps++;
                if(numOps === 3){
                    done();
                }
            })
        });
//        it('BitstampOrderBookDiff', function (done) {
//            this.timeout(120e3);
//            var numOps = 0;
//            apiws.ee().on("orderBookDiff", function(orderBookDiff){
//                assert(orderBookDiff);
//                console.log("orderBookDiff:")
//                console.log(JSON.stringify(orderBookDiff));
//               
//                numOps++;
//                if(numOps === 5){
//                    done();
//                }
//            })
//        });
    });
    
    describe('BitstampRest', function () {
        var apirest = new BitstampEx.RestClient(config.provider);
        it('BitstampBalance', function (done) {
            this.timeout(30e3);
            apirest.getBalances()
            .then(function(balances){
                assert(balances)
                assert(balances['BTC'])
                done();
            })
            .fail(done)
        });
        it('BitstampSellPriceDecimalKo', function (done) {
            this.timeout(10e3);
            var param = {
                    market: "BTCUSD",
                    type: "ask",
                    orderType: "market",
                    amount: "0.001",
                    price:"500.000"
            }
            apirest.order(param)
            .fail(function(error){
                assert(error);
                //assert(error.price);
                assert(error.__all__);
                assert.equal(error.__all__[0], "Minimum order size is $5")
                console.log(JSON.stringify(error))
                done()
            })
            .fail(done)
        });
        it('BitstampSellAmountDecimalOk', function (done) {
            this.timeout(10e3);
            var param = {
                    market: "BTCUSD",
                    type: "ask",
                    orderType: "market",
                    amount: "0.00111111",
                    price:"500"
            }
            apirest.order(param)
            .fail(function(error){
                assert(error);
                //assert(error.price);
                assert.equal(error.__all__[0], "Minimum order size is $5")
                assert.equal(error.__all__[0], "Minimum order size is $5")
                console.log(JSON.stringify(error))
                done()
            })
            .fail(done)
        });
        it('BitstampSellBelow', function (done) {
            this.timeout(10e3);
            var param = {
                    market: "BTCUSD",
                    type: "ask",
                    orderType: "market",
                    amount: "0.001",
                    price:"500.00"
            }
            apirest.order(param)
            .fail(function(error){
                assert(error);
                assert(error.__all__);
                console.log(JSON.stringify(error))
                done()
            })
            .fail(done)
        });
        
        it('BitstampSellOk', function (done) {
            this.timeout(10e3);
            var param = {
                    market: "BTCUSD",
                    type: "ask",
                    orderType: "limit",
                    amount: "0.01",
                    price:"1000"
            }
            Utils.orderAndCancel(apirest, param, done);
        });
        it('BitstampBuyOk', function (done) {
            this.timeout(10e3);
            var param = {
                    market: "BTCUSD",
                    type: "bid",
                    orderType: "limit",
                    amount: "0.05",
                    price:"100"
            }
            Utils.orderAndCancel(apirest, param, done);
        });
    });
});
