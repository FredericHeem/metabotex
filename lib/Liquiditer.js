"use strict";
var _ = require('underscore');
var Q = require("q");
var EventEmitter = require('events').EventEmitter;
var log = require('./log')(__filename)
var debug = log.debug

function Liquiditer(config) {
    
    var exchanges = {};
    
    function init(){
        _.each(config.exchanges, function(exchangeConfig, key){
            debug("%s: %s", JSON.stringify(exchangeConfig), key);
            var Exchange = require('./' + exchangeConfig.driver);
            var exchange = new Exchange.Client(config);
            exchanges[key] = exchange;
        })
        
        var Airbex = require('airbex-client');
        exchanges['airbex'] = new Airbex.WebSocketClient(config.target);
    }
    
    init();
    
    this.getBalances = function(){
        var promises = [];
        _.each(exchanges, function(exchange){
            promises.push(exchange.getBalances());
        })
        return Q.all(promises)
        .then(function(results){
            debug(JSON.stringify(results, null, 4))
        })
    }

    this.getDepth = function(market){
        var promises = [];
        _.each(exchanges, function(exchange){
            promises.push(exchange.getDepth(market));
        })
        return Q.all(promises)
        .then(function(){
            
        })
    }
    
    this.start = function() {
        var promises = [];
        _.each(exchanges, function(exchange){
            promises.push(exchange.start());
        })
        return Q.all(promises)
        .then(function(results){
        })
    }

    this.stop = function stop() {
       
    }
    
}



module.exports = Liquiditer;