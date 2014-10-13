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
    }
    
    init();
    
    this.getBalances = function(){
        var promises = [];
        _.each(exchanges, function(exchange){
            promises.push(exchange.getBalances());
        })
        return Q.all(promises)
        .then(function(){
            
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
        var deferred = Q.defer();
        
        deferred.resolve();
        return deferred.promise;
    }

    this.stop = function stop() {
       
    }
    
}



module.exports = Liquiditer;