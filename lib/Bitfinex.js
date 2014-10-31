"use strict";
var Q = require("q");
var Bitfinex = require('bitfinex');
var util = require('util');
var ClientBase = require('./ClientBase')
var log = require('./log')(__filename)
var debug = log.debug
var _ = require('underscore')

function formatDepth(depth){
    //console.log("depth: ", JSON.stringify(depth))
    var depthFormatted = {
            bids:_.map(depth.bids, function(item){
                return [item.price, item.amount]
            }),
            asks:_.map(depth.asks,function(item){
                return [item.price, item.amount]
            })
    }
    //console.log("depth f: ", JSON.stringify(depthFormatted))
    return depthFormatted;
}

function formatBalances(balances){
    var balancesMap = {};
    _.each(balances, function(item) {
        //debug(item)
        if(item.type === 'exchange'){
            balancesMap[item.currency.toUpperCase()] = {
                    currency:item.currency.toUpperCase(),
                    balance: item.amount,
                    available: item.available
            }
        }
        
    })
    return balancesMap;
}

function WebSocketClient(config) {
    RestClient.call(this, config);
    
    //var _ws = new Airbex.WebSocketClient(config);
    
    var me = this;
    this.start = function() {
        log.debug("start");
//        return _ws.start();
    }

    this.on = function(message, callback) {
//        _ws.on(message, callback)
    }
    
    this.stop = function stop() {
        log.debug("stop ws");
        ClientBase.stop.call(this);
    }
    
//    this.monitorOrderBook = function(market){
//        
//    }
}

util.inherits(WebSocketClient, RestClient);

function RestClient(config) {
    var me = this;
    console.log(config)
    ClientBase.call(this, config);
    
    var bitfinex = new Bitfinex(config.key, config.secret);
    this.getBalances = function(){
        debug("balances")
        var deferred = Q.defer();
        bitfinex.wallet_balances(function(err, balances){
            if(err){
                log.error("balances: ", err);
                return deferred.reject(err)
            }
            
            var balancesFormatted = formatBalances(balances)
            debug(JSON.stringify(balancesFormatted));
            me.set("balances", balancesFormatted);
            deferred.resolve(balancesFormatted);
        })
        return deferred.promise;
    }
    
    this.getDepth = function(market){
        var deferred = Q.defer();
        bitfinex.orderbook(market.toUpperCase(), function(err, depth){
            if(err){
                log.error("depth: ", err);
                return deferred.reject(err)
            }
            var depthFormatted = formatDepth(depth)
            //me.set("balances", balances);
            deferred.resolve(depthFormatted);
        });
        return deferred.promise;
    } 
    
    this.order = function(param){
        // TODO
        var deferred = Q.defer();
        bitfinex.order(param);
        deferred.resolve(depth);
    }
}

util.inherits(RestClient, ClientBase);

module.exports = {
        Client:RestClient,
        RestClient: RestClient
};