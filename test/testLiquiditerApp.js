/*global describe, it, before, after*/
var assert = require('assert');
var request = require('supertest');
var async = require('async');
var _ = require('underscore');
var fs = require("fs");
var debug = require('debug')('WebSocket');
var num = require('num');
var LiquiditerApp = require('../lib/LiquiditerApp')
var Q = require('Q')
var markets = ['bitstampbtcusdlocal'];
var markets = [
               'bitstampbtcusdlocal', 
               'bitfinexbtcusdlocal',
               'bitfinexltcbtclocal',
               'bitfinexdrkbtclocal',
               'btceltcbtclocal',
               'cryptsydogebtclocal',
               'krakenbtceurlocal'
               ];

describe('LiquiditerApp', function () {
    "use strict";
    var liquiditerApps = [];
    describe('LiquiditerApp', function () {
        
        before(function(done){
            this.timeout(5e3);
            _.each(markets, function(market){
                var config = (JSON.parse(fs.readFileSync("test/config/config." + market + ".json", "utf8")));
                liquiditerApps.push(new LiquiditerApp(config));
            })
            done();
        })
        it('LiquiditerAppOk', function (done) {
            this.timeout(100e3)
            Q.all(_.map(liquiditerApps, function(liquiditerApp){
                return liquiditerApp.start();
            }))
            .delay(30e3)
            .then(function(){
                return Q.all(_.map(liquiditerApps, function(liquiditerApp){
                    return liquiditerApp.stop();
                }))
            })
            .then(function(){
                
            })
            .then(done)
            .fail(done);
        });


    });
});
