"use strict";
var _ = require('underscore');
var Q = require("q");
var BTCE = require('btc-e');
var util = require('util');
var ClientBase = require('./ClientBase')
var log = require('./log')(__filename)
var debug = log.debug
var assert = require('assert');
var num = require('num');

var _marketInfo = {
        "BTCUSD":{
            baseScale:8,
            quoteScale:2
        },
        "LTCBTC":{
            baseScale:8,
            quoteScale:5
        }
}

var numberRegex = /^[0-9\.]+$/

function convertVolume(market, volume){
    if (!volume.match(numberRegex)) {
        throw new Error('Invalid number format ' + volume)
    }
    var scale = _marketInfo[market].baseScale;
    assert(scale);
    var result = num(volume)
    result.set_precision(scale);
    return result.toString()
}

function convertPrice(market, price){
    if (!price.match(numberRegex)) {
        throw new Error('Invalid number format ' + price)
    }
    var scale = _marketInfo[market].quoteScale;
    assert(scale);
    var result = num(price);
    result.set_precision(scale);
    return result.toString()
}
    
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
                log.error("getBalances: ", err.toString())
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
    
    this.order = function(param){
        var deferred = Q.defer();
        
        log.info("order: ", param)

        var pair = formatMarketName(param.market);
        var amount = convertVolume(param.market, param.amount);
        var price = convertPrice(param.market, param.price);
        var type = param.type === 'bid' ? "buy":"sell";
        
        log.info("order: pair:%s, amount:%s, price:%s, type: %s",
                pair, amount, price, type);
        
        btce.trade(pair, type, price, amount, function (err, data) {
            debug("order result")
            if(err){
                log.error("order: ", err.toString());
                log.error("order: ", JSON.stringify(err));
                return deferred.reject(err)
            }
            if(data.error && data.error.length > 0){
                log.error("order: ", JSON.stringify(data.error));
                return deferred.reject(data.error)
            }
            
            debug("order ok: ", JSON.stringify(data));
            deferred.resolve({oid:data.order_id, details:data});
        });
        
        return deferred.promise;
    }
    
    this.orderCancel = function(orderId){
        var deferred = Q.defer();
        
        log.info("orderCancel: ", orderId)

        btce.cancelOrder(orderId, function (err, data) {
            debug("orderCancel result")
            if(err){
                log.error("orderCancel: ", err.toString());
                log.error("orderCancel: ", JSON.stringify(err));
                return deferred.reject(err)
            }
            if(data.error && data.error.length > 0){
                log.error("orderCancel: ", JSON.stringify(data.error));
                return deferred.reject(data.error)
            }
            
            debug("orderCancel ok: ", JSON.stringify(data));
            deferred.resolve();
        });
        
        return deferred.promise;
    }
}

util.inherits(RestClient, ClientBase);

module.exports = {
        Client:RestClient,
        RestClient: RestClient
};