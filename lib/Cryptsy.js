"use strict";
var Q = require("q");
var Cryptsy = require('cryptsy');
var util = require('util');
var ClientBase = require('./ClientBase')
var log = require('./log')(__filename)
var debug = log.debug
var _ = require('underscore')
var assert = require('assert');

var _marketNameToId = {
    "DRKBTC": 155,
    "DOGEBTC":132,
    "LTCBTC":3
}

function formatDepth(result, baseCurrency){
    var data = result.markets[Object.keys(result.markets)[0]];
    
    var bids = data.buyorders;
    var asks = data.sellorders;
    //debug("bids: ", JSON.stringify(bids, null, 2))
    //debug("asks: ", JSON.stringify(asks, null, 2))
    var depthFormatted = {
            bids:_.map(bids, function(item){
                return [item.price, item.quantity]
            }),
            asks:_.map(asks,function(item){
                return [item.price, item.quantity]
            })
    }
    //debug("depth formatted: ", JSON.stringify(depthFormatted))
    return depthFormatted;
}

function RestClient(config) {
    var me = this;
    console.log(config)
    ClientBase.call(this, config);
    
    var cryptsy_pub = new Cryptsy();
    var cryptsy = new Cryptsy(config.key, config.secret);
    
    function formatBalances(result){
        //debug(JSON.stringify(result, null, 4));
        var balancesMap = {};
        _.each(result.balances_available, function(item, key) {
            //debug("formatBalances key: %s, value", key, item);
            assert(config.currencies)
            if(config.currencies.indexOf(key) != -1){
                balancesMap[key]= {
                    currency: key,
                    balance: result.balances_available[key].toString(),
                    available: result.balances_available[key].toString()
                }
            }
        })
        //debug("balances ", JSON.stringify(balancesMap, null, 4));
        return balancesMap;
    }
    
    this.getBalances = function(){
        debug("balances")
        var deferred = Q.defer();
        cryptsy.api('getinfo', null, function (err, data) {
            if(err){
                log.error("balances: ", err);
                return deferred.reject(err)
            }
            
            var balancesFormatted = formatBalances(data)
            //debug(JSON.stringify(balancesFormatted));
            me.set("balances", balancesFormatted);
            deferred.resolve(balancesFormatted);
        })
        return deferred.promise;
    }
    
    this.getDepth = function(market){
        var deferred = Q.defer();
        var marketId = _marketNameToId[market];
        assert(marketId);
        cryptsy_pub.api('singlemarketdata', { marketid: marketId }, function (err, data) {
            if(err){
                log.error("depth: ", err);
                return deferred.reject(err)
            }
            
            
            var depthFormatted = formatDepth(data);
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