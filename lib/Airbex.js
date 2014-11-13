"use strict";
var Q = require("q");
var Airbex = require('airbex-client');
var util = require('util');
var ClientBase = require('./ClientBase')
var log = require('./log')(__filename)
var debug = log.debug
var _ = require('underscore')

function formatBalances(balances){
    var balancesMap = {};
    _.each(balances, function(item) {
        balancesMap[item.currency] = {
                currency:item.currency,
                balance: item.balance,
                available: item.available,
                hold: item.hold
        }
    })
    return balancesMap;
}

function formatMarketsInfo(markets){
    var marketsInfoMap = {};
    _.each(markets, function(item) {
        marketsInfoMap[item.id] = item;
    })
    return marketsInfoMap;
}

function formatCurrencies(currencies){
    var currenciesMap = {};
    _.each(currencies, function(item) {
        currenciesMap[item.id] = item;
    })
    return currenciesMap;
}

function WebSocketClient(config) {
    RestClient.call(this, config);
    debug("WebSocketClient");
    var _ws = new Airbex.WebSocketClient(config);
    
    var me = this;
    this.start = function() {
        log.debug("start");
        return _ws.start()
        .then(function(){
            return _ws.getUser()
        })
        .then(function(user){
            log.debug("started: ", user);
        })
        .fail(function(error){
            log.error("started with errors");
            throw new Error(error)
        })
    }

    this.on = function(message, callback) {
        _ws.on(message, callback)
    }
    
    this.registerMessage = function(message, callback){
        log.debug("registerMessage ", message);
        _ws.getIo().on(message, callback)
        //_ws.registerMessage(message, callback);
    }
    
    this.stop = function stop() {
        log.debug("stop");
        
        return _ws.stop();
    }
    
    this.monitorOrderBook = function(market){
        
    }
}

util.inherits(WebSocketClient, RestClient);

function RestClient(config) {
    var me = this;
    ClientBase.call(this, config);
    
    var airbex = new Airbex.RestClient(config);
    this.getBalances = function(){
        return airbex.getBalances().then(function(balances){
            var balancesFormatted = formatBalances(balances)
            me.set("balances", balancesFormatted);
            return balancesFormatted;
        })
        .fail(function(error){
            log.error("getBalances: ", error.toString());
            throw new Error(error);
        })
    }
    
    this.fetchCurrencies = function(){
        return airbex.getCurrencies().then(function(currencies){
            var currenciesFormatted = formatCurrencies(currencies);
            me.set("currencies", currenciesFormatted);
            return currenciesFormatted;
        })
    } 
    
    this.fetchMarketsInfo = function(){
        return airbex.getMarketsInfo().then(function(marketsInfo){
            var marketsInfoFormatted = formatMarketsInfo(marketsInfo);
            me.set("marketsInfo", marketsInfoFormatted);
            return marketsInfoFormatted;
        })
    } 
    
    this.getDepth = function(market){
        return airbex.getDepth(market);
    } 
   
    this.orderCancel = function(oid){
        return airbex.orderCancel(oid);
    } 
    
    this.order = function(param){
        return airbex.order(param);
    } 
    
    this.orderCancelAll = function(market){
        return airbex.orderCancelAll(market);
    } 
}

util.inherits(RestClient, ClientBase);

module.exports = {
        Client:WebSocketClient,
        RestClient: RestClient
};