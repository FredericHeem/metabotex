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
    var _ee = new EventEmitter();
    var pusher = new Pusher('de504dc5763aeef9ff52');
    
    this.start = function() {
        var deferred = Q.defer();
        
        var orderBookChannel = pusher.subscribe('order_book');
        orderBookChannel.bind('data', function(orderBook) {
            _ee.emit(wsMessages.orderBook, orderBook);
        });
        
        var orderBookDiffChannel = pusher.subscribe('diff_order_book');
        orderBookDiffChannel.bind('data', function(orderBookDiff) {
            debug("orderBookDiff rx")
            _ee.emit(wsMessages.orderBookDiff, orderBookDiff);
        });
        
        deferred.resolve();
        return deferred.promise;
    }

    this.stop = function stop() {
       
    }
    
    this.on = function(message, cb){
        _ee.on(message, cb);
    }  
}

util.inherits(WebSocketClient, RestClient);

function RestClient(config) {
    ClientBase.call(this);
    
    var configBitstamp = config.exchanges.bitstamp;
    var bitstamp = new Bitstamp(configBitstamp.key, configBitstamp.secret, configBitstamp.client_id);
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
            debug("balances", JSON.stringify(balancesFormatted))
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