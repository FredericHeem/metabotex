"use strict";
var Q = require("q");
var Bitfinex = require('bitfinex');
var util = require('util');
var ClientBase = require('./ClientBase')
var log = require('./log')(__filename)
var debug = log.debug
var _ = require('underscore')
var assert = require('assert');
var num = require('num');

var _marketInfo = {
        "BTCUSD":{
            baseScale:8,
            quoteScale:5
        },
        "LTCBTC":{
            baseScale:8,
            quoteScale:5
        },
        "DRKBTC":{
            baseScale:8,
            quoteScale:5
        }
}

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
    //debug("depth f: ", JSON.stringify(depthFormatted))
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

function convertMarket(market){
    return market.toLowerCase();
}

function convertOrderType(orderType){
    var TYPES= {
        "limit":"exchange limit"
    };
    
    var native = TYPES[orderType];
    if(!native){
        throw new Error("Invalid order type: " + orderType)
    }
    return native;
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
            //debug(JSON.stringify(balancesFormatted));
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
            deferred.resolve(depthFormatted);
        });
        return deferred.promise;
    } 
    
    this.order = function(param){
        var deferred = Q.defer();
        
        log.info("order: ", param)

        var symbol = convertMarket(param.market);
        var amount = convertVolume(param.market, param.amount);
        var price = convertPrice(param.market, param.price);
        var exchange = "bitfinex";
        var side = param.type === 'bid' ? "buy":"sell";
        var type = convertOrderType(param.orderType);
        
        log.info("order: symbol:%s, amount:%s, price:%s, side:%s, type: %s",
                symbol, amount, price, side, type);
        
        bitfinex.new_order(symbol, amount, price, exchange, side, type, function (err, data) {
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
            deferred.resolve({oid:data.id, details:data});
        });
        
        return deferred.promise;
    }
    
    this.orderCancel = function(orderId){
        var deferred = Q.defer();
        
        log.info("orderCancel: ", orderId)

        bitfinex.cancel_order(orderId, function (err, data) {
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
            
            debug("order ok: ", JSON.stringify(data));
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