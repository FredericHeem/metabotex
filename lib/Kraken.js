"use strict";
var Q = require("q");
var Kraken = require('kraken-api');
var util = require('util');
var ClientBase = require('./ClientBase')
var log = require('./log')(__filename)
var debug = log.debug
var _ = require('underscore')
var assert = require('assert');

var _marketNameToId = {
    "BTCEUR": "XBTEUR",
    "BTCUSD": "XBTUSD"
}

function convertMarketToProvider(market){
    var makretProvider =  _marketNameToId[market] || market
    return makretProvider
}

var _currencyMap = {
        "BTC":"XBT",
        "EUR":"EUR",
}

function convertCurrencyToProvider(currency){
    var currencyProvider =  _currencyMap[currency] || currency
    return currencyProvider
}

function formatDepth(result){
    //debug(JSON.stringify(data.result, null, 4))
    var depth = result[Object.keys(result)[0]];
    var bids = depth.bids;
    var asks = depth.asks;
    //debug("bids: ", JSON.stringify(bids, null, 2))
    //debug("asks: ", JSON.stringify(asks, null, 2))
    var depthFormatted = {
            bids:_.map(bids, function(item){
                return [item[0], item[1]]
            }),
            asks:_.map(asks,function(item){
                return [item[0], item[1]]
            })
    }
    //debug("depth formatted: ", JSON.stringify(depthFormatted))
    return depthFormatted;
}



function RestClient(config) {
    var me = this;
    console.log(config)
    ClientBase.call(this, config);
    
    var kraken = new Kraken(config.key, config.secret);
    
    function formatBalances(result){
        debug(JSON.stringify(result, null, 4));
        var balancesMap = {};
        
        _.each(config.currencies, function(currency) {
            debug("formatBalances currency: %s", currency);
            var currencyProvider = convertCurrencyToProvider(currency);
            if(result[currencyProvider]){
                balancesMap[currency]= {
                        currency: currency,
                        balance: "0",
                        available: "0"
                } 
            } else {
                balancesMap[currency]= {
                        currency: currency,
                        balance: "0",
                        available: "0"
                }
            }
        })
        debug("balances ", JSON.stringify(balancesMap, null, 4));
        return balancesMap;
    }
    
    this.getBalances = function(){
        debug("balances")
        var deferred = Q.defer();
        kraken.api('Balance', null, function (err, data) {
            if(err){
                log.error("depth: ", JSON.stringify(err));
                return deferred.reject(err)
            }
            if(data.error && data.error.length > 0){
                log.error("depth: ", JSON.stringify(data.error));
                return deferred.reject(data.error)
            }
            
            var balancesFormatted = formatBalances(data.result)
            //debug(JSON.stringify(balancesFormatted));
            me.set("balances", balancesFormatted);
            deferred.resolve(balancesFormatted);
        })
        return deferred.promise;
    }
    
    this.getDepth = function(market){
        
        var deferred = Q.defer();
        var marketId = convertMarketToProvider(market);
        assert(marketId, "Ciao");
        kraken.api('Depth', {"pair": marketId}, function (err, data) {
            debug("Depth result")
            if(err){
                log.error("depth: ", JSON.stringify(err));
                return deferred.reject(err)
            }
            if(data.error && data.error.length > 0){
                log.error("depth: ", JSON.stringify(data.error));
                return deferred.reject(data.error)
            }
            
            var depthFormatted = formatDepth(data.result);
            //debug("depth", depthFormatted)
            deferred.resolve(depthFormatted);
        });
        
        return deferred.promise;
    } 
    
 
}

util.inherits(RestClient, ClientBase);

module.exports = {
        Client:RestClient,
        RestClient: RestClient
};