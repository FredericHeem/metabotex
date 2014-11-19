"use strict";
var Q = require("q");
var Kraken = require('kraken-api');
var util = require('util');
var ClientBase = require('./ClientBase')
var log = require('./log')(__filename)
var debug = log.debug
var _ = require('underscore')
var assert = require('assert');
var num = require('num');

var _marketNameToId = {
    "BTCEUR": "XBTEUR",
    "BTCUSD": "XBTUSD"
}

function convertMarketToProvider(market){
    var makretProvider =  _marketNameToId[market] || market
    return makretProvider
}

var _currencyMap = {
        "BTC":"XXBT",
        "EUR":"ZEUR",
}

var _marketInfo = {
        "BTCEUR":{
            baseScale:8,
            quoteScale:5
        }
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
    this.setMarketInfo(_marketInfo);
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
                        balance: result[currencyProvider],
                        available: result[currencyProvider]
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
    
    function formatMarketsInfo(markets){
        debug("markets:", JSON.stringify(markets))
        var marketsInfoMap = {};
        _.each(markets, function(item) {
            marketsInfoMap[item.altname] = item;
        })
        debug("markets: formatted", JSON.stringify(marketsInfoMap, null, 4))
        return marketsInfoMap;
    }
    
    this.fetchMarketsInfo = function(){
        var deferred = Q.defer();
        log.info("fetchMarketsInfo: ")
       
        kraken.api('AssetPairs', null, function (err, data) {
            debug("order result")
            if(err){
                log.error("fetchMarketsInfo: ", err.toString());
                log.error("fetchMarketsInfo: ", JSON.stringify(err));
                return deferred.reject(err)
            }
            if(data.error && data.error.length > 0){
                log.error("fetchMarketsInfo: ", JSON.stringify(data.error));
                return deferred.reject(data.error)
            }
            var marketsInfoFormatted = formatMarketsInfo(data.result);
            me.set("marketsInfo", marketsInfoFormatted);
            deferred.resolve(marketsInfoFormatted);
        });
        
        return deferred.promise;
    } 
    
    this.order = function(param){
        var deferred = Q.defer();
        
        log.info("order: ", param)
        var krakenParam = {
            pair:convertMarketToProvider(param.market),
            type: param.type === 'bid' ? "buy":"sell",
            ordertype:param.orderType || 'limit',
            price:param.price ? this.convertPrice(param.market, param.price, param.type) : undefined,
            volume:this.convertVolume(param.market, param.amount)
        }
        
        log.info("order: kraken: ", krakenParam)
        kraken.api('AddOrder', krakenParam, function (err, data) {
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
            debug("txid:", data.result.txid[0]);
            deferred.resolve({oid:data.result.txid[0], details:data.result});
        });
        
        return deferred.promise;
    }
    this.orderCancel = function(orderId){
        var deferred = Q.defer();
        
        log.info("orderCancel: ", orderId)
        
        kraken.api('CancelOrder', {txid:orderId}, function (err, data) {
            debug("orderCancel result")
            if(err){
                log.error("order: ", err.toString());
                log.error("order: ", JSON.stringify(err));
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