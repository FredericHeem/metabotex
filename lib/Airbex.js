"use strict";
var Q = require("q");
var Airbex = require('airbex-client');
var util = require('util');
var ClientBase = require('./ClientBase')
var log = require('./log')(__filename)
var debug = log.debug
var _ = require('underscore')

//util.inherits(WebSocketClient, RestClient);

function RestClient(config) {
    var me = this;
    ClientBase.call(this, config);
    
    var airbex = new Airbex.RestClient(config);
    this.getBalances = function(){
        var balancesMap = {}
        return airbex.getBalances().then(function(balances){
            _.each(balances, function(item) {
                balancesMap[item.currency] = {
                        currency:item.currency,
                        balance: item.balance,
                        available: item.available,
                        hold: item.hold
                }
            })
            return balancesMap;
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
        RestClient: RestClient
};