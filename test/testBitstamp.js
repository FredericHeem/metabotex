/*global describe, it, before, after*/
var assert = require('assert');
var request = require('supertest');
var async = require('async');
var _ = require('underscore');
var config = require('./configTest.js')('bitstampbtcusdlocal');
var debug = require('debug')('WebSocket');
var BitstampEx = require('../lib/Bitstamp');
var num = require('num');

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
        var apiws = new BitstampEx.WebSocketClient(config.provider);
        before(function(done) {
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
                if(numOps === 5){
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
    });
});
