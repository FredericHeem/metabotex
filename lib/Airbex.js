"use strict";
var Q = require("q");
var Airbex = require('airbex-client');
var util = require('util');
var ClientBase = require('./ClientBase')
var log = require('./log')(__filename)
var debug = log.debug
var _ = require('underscore')

//util.inherits(WebSocketClient, RestClient);
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

function WebSocketClient(config) {
    RestClient.call(this, config);
    
    var _ws = new Airbex.WebSocketClient(config);
    
    var me = this;
    this.start = function() {
        log.debug("start");
        return _ws.start();
    }

    this.registerMessage = function(message, callback){
        log.debug("registerMessage ", message);
        _ws.getIo().on(message, callback)
        //_ws.registerMessage(message, callback);
    }
    
    this.stop = function stop() {
        log.debug("stop");
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
            me.set("balances", balances);
            return balancesFormatted;
        });
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