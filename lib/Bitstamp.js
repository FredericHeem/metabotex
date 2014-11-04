"use strict";
var Q = require("q");
var EventEmitter = require('events').EventEmitter;
var Pusher = require('pusher-client');
var Bitstamp = require('bitstamp');
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
    var _orderBookChannel;
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

    this.stop = function() {
        log.debug("stop");
        if(_orderBookChannel){
            pusher.unsubscribe('order_book');
        }
    }
    
    this.monitorOrderBook = function(market){
        if(_orderBookChannel){
            return;
        }
        _orderBookChannel = pusher.subscribe('order_book');
        _orderBookChannel.bind('data', function(orderBook) {
            //debug("orderBookPartial rx", JSON.stringify(orderBook))
            me.ee().emit(wsMessages.orderBook, orderBook);
        });
    }
}

util.inherits(WebSocketClient, RestClient);

function RestClient(config) {
    var me = this;
    ClientBase.call(this, config);
    //debug("RestClient config ", config)
    var bitstamp = new Bitstamp(config.key, config.secret, config.client_id);
    this.getBalances = function(){
        var deferred = Q.defer();
        bitstamp.balance(function(err, balances){
            if(balances && balances.error){
                log.error("getBalances:", balances.error)
                return deferred.reject(balances.error)
            } 
            
            if(err){
                log.error("getBalances:", err.toString())
                return deferred.reject(err)
            }
            
            if(!balances){
                return deferred.reject({name:"NoBalances"})
            }
            var balancesFormatted = {
                    BTC:{
                        currency:'BTC', 
                        balance: balances.btc_balance,
                        available: balances.btc_available,
                        hold:balances.btc_reserved
                    },
                    USD:{
                        currency:'USD',
                        balance: balances.usd_balance,
                        available: balances.usd_available,
                        hold:balances.usd_reserved
                    }
                    
            };
            

            //debug("balances", JSON.stringify(balancesFormatted));
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