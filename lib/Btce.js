"use strict";
var _ = require('underscore');
var Q = require("q");
var BTCE = require('btc-e');
var util = require('util');
var ClientBase = require('./ClientBase')
var log = require('./log')(__filename)
var debug = log.debug

function formatMarketName(market){
    var pair = market.substr(0,3).toLowerCase() + '_' + market.substr(3,3).toLowerCase();
    return pair;
}

function formatDepth(depth){
    //console.log("depth: ", JSON.stringify(depth))
    var depthFormatted = {
            bids:_.map(depth.bids, function(item){
                return [item[0].toString(), item[1].toString()]
            }),
            asks:_.map(depth.asks,function(item){
                return [item[0].toString(), item[1].toString()]
            })
    }
    //console.log("depth f: ", JSON.stringify(depthFormatted))
    return depthFormatted;
}
function RestClient(config) {
    ClientBase.call(this, config);
    
    var btce = new BTCE(config.key, config.secret);
    
    this.getBalances = function(){
        debug("getBalances");
        var deferred = Q.defer();
        var me = this;
        btce.getInfo(function(err, info){
            if(err){
                log.error("getBalances: ", err)
                return deferred.reject(err)
            }
            if(!info){
                log.error("getBalances: cannot get info")
                return deferred.reject({name:"BalanceError"})
            }
            debug(JSON.stringify(info))
            var balances = {};
            Object.keys(info.funds).forEach(function (key) {
                if(config.currencies.indexOf(key.toUpperCase()) != -1){
                    balances[key.toUpperCase()]= {
                        currency: key.toUpperCase(),
                        balance: info.funds[key].toString(),
                        available: info.funds[key].toString()
                    }
                }
            });
            //debug("balances", JSON.stringify(balances))
            me.set("balances", balances);
            deferred.resolve(balances);
        })
        return deferred.promise;
    }
    
    this.getDepth = function(market){
        debug("getDepth ", market);
        var deferred = Q.defer();
        btce.depth(formatMarketName(market), function(err, depth){
            if(err){
                log.error("depth ", JSON.stringify(err))
                return deferred.reject(err)
            } 
            
            //debug("depth: ", JSON.stringify(depth))
            deferred.resolve(formatDepth(depth));
        })
        return deferred.promise;
    }
}

util.inherits(RestClient, ClientBase);

module.exports = {
        Client:RestClient,
        RestClient: RestClient
};