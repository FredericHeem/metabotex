"use strict";
var Q = require("q");
var EventEmitter = require('events').EventEmitter;
var Pusher = require('pusher-client');
var Bitstamp = require('Bitstamp');
var util = require('util');
var ClientBase = require('./ClientBase')
var log = require('./log')(__filename)
var debug = log.debug

var wsMessages = {
        orderBook:"orderBook",
        orderBookDiff:"orderBookDiff"
}

function WebSocketClient(config) {
    RestClient.call(this, config);
    //var _ee = new EventEmitter();
    var pusher = new Pusher('de504dc5763aeef9ff52');
    var me = this;
    this.start = function() {
        log.debug("start");
        var deferred = Q.defer();
        
        pusher.connection.bind('state_change', function(states) {
            log.debug("state %s => %s ", states.previous, states.current);
        });
        pusher.connection.bind('connected', function() {
            log.debug("connected");
            deferred.resolve();
        })
        return deferred.promise;
    }

    this.stop = function stop() {
       
    }
    this.monitorOrderBook = function(market){
        var orderBookChannel = pusher.subscribe('order_book');
        orderBookChannel.bind('data', function(orderBook) {
            //debug("orderBookPartial rx", JSON.stringify(orderBook))
            me.ee().emit(wsMessages.orderBook, orderBook);
        });
    }
}

util.inherits(WebSocketClient, RestClient);

function RestClient(config) {
    var me = this;
    ClientBase.call(this, config);
    
    var bitstamp = new Bitstamp(config.key, config.secret, config.client_id);
    this.getBalances = function(){
        var deferred = Q.defer();
        bitstamp.balance(function(err, balances){
            if(balances.error){
                return deferred.reject(balances.error)
            } 
            
            var balancesFormatted = 
                [
                 {
                     currency:'BTC', 
                     balance: balances.btc_balance,
                     available: balances.btc_available,
                     hold:balances.btc_reserved
                 },
                 {
                     currency:'USD',
                     balance: balances.usd_balance,
                     available: balances.usd_available,
                     hold:balances.usd_reserved
                 }
                 ];
            debug("balances", JSON.stringify(balancesFormatted));
            me.set("balances", balancesFormatted);
            deferred.resolve(balancesFormatted);
        })
        return deferred.promise;
    }
    
    this.getDepth = function(market){
        var deferred = Q.defer();
        bitstamp.order_book(market, function(err, depth){
            if(depth.error){
                return deferred.reject(depth.error)
            } 
            
            
            //debug("depth", JSON.stringify(depth))
            deferred.resolve(depth);
        })
        return deferred.promise;
    } 
}

util.inherits(RestClient, ClientBase);

module.exports = {
        Client:WebSocketClient,
        WebSocketClient: WebSocketClient,
        RestClient: RestClient
};