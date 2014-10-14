"use strict";
var _ = require('underscore');
var async = require('async');
var Q = require("q");
var EventEmitter = require('events').EventEmitter;
var DepthUtils = require('./DepthUtils')
var log = require('./log')(__filename)
var debug = log.debug

function Liquiditer(config) {
    
    var exchanges = {};
    var maxParallelOps = 16;
    var client;
    var _orders = {}
    var _market = config.market;
    
    function findOrderId(bidAsk){
        var orderId;
        for (var orderId in _orders) {
            if(_.isEqual(_orders[orderId], bidAsk)){
                debug("findOrderId bidAsk %s, id: %s", bidAsk, orderId);
                delete _orders[orderId];
                return orderId;
            }
        }
        log.error("findOrderId no order id for ", bidAsk)
    }
    function cancelOrder(removed){
        debug("cancelOrder #asks %d", removed.length);
        var deferred = Q.defer();
        async.forEachLimit(removed, maxParallelOps,function(ask, callback) {
            var price = ask[0];
            var amount = ask[1];
            debug("cancelOrder price: %d amount: %d", price, amount);
            var orderId = findOrderId(ask);
            if(!orderId){
                log.error("order not found for ", ask)
                return callback({name:"OrderNotFound"})
            }
            client.orderCancel(orderId)
            .then(function(){
                debug('cancelOrder done');
                callback()
            }).fail(function(err){
                log.error("cancelOrder ", err);
                callback(err)
            })
        },
        function(err) {
            if (err) {
                log.error("cancelOrder ", err);
                deferred.reject(err)
            } else {
                debug('cancelOrder done ');
                deferred.resolve();
            }
        });
        return deferred.promise;
    }
    function sendAsks(asks) {
        debug("sendAsk #asks %d", asks.length);
        var deferred = Q.defer();
        async.forEachLimit(asks, maxParallelOps,function(ask, callback) {
            var price = ask[0];
            var amount = ask[1];
            debug("sendAsk price: %d amount: %d", price, amount);
            client.order({
                market: config.market,
                type: "ask",
                price: price,
                amount: amount
            }).then(function(result){
                _orders[result.id] = ask;
                debug('sendAsk #%s placed', result.id);
                callback()
            }).fail(function(err){
                log.error("sendAsk ", err);
                callback(err)
            })
        },
        function(err) {
            if (err) {
                log.error("sendAsk ", err);
                deferred.reject(err)
            } else {
                debug('sendAsk done ', asks);
                deferred.resolve();
            }
        });
        return deferred.promise;
    };
    
    function onOrderBook(exchange, orderBook){
        //debug('onOrderBookDiff');
        var balanceProviderQc = "1000";
        var balanceProviderBc = "5";
        var maxAmountProvider = DepthUtils.getTotalBuyAmountFromBalance(balanceProviderQc, orderBook.asks);
        var maxAmount = Math.min(maxAmountProvider, "0.5");
        debug('onOrderBookDiff maxAmount to buy ', maxAmount);
        
        var bids = DepthUtils.filterWithAmount(balanceProviderBc, orderBook.bids);
        debug('onOrderBookDiff bids ', bids);

        var diffBids = DepthUtils.computeAddedRemoved(
                exchange.getOrderBook().bids, 
                bids);
        debug(diffBids);
        
        var asks = DepthUtils.filterWithAmount(maxAmount, orderBook.asks);
        debug('onOrderBookDiff asks ', asks);
        
        var diffAsks = DepthUtils.computeAddedRemoved(
                exchange.getOrderBook().asks, 
                asks);
        
        debug(diffAsks);
        
        exchange.setOrderBook({bids:bids, asks:asks});
        
        cancelOrder(diffAsks.removed)
        .then(function(){
            return sendAsks(diffAsks.added)
        })
        .then(function(){
            
        })
        .fail(function(err){
            log.error("onOrderBook ", err)
        })
    }
    
    function init(){
        _.each(config.exchanges, function(exchangeConfig, key){
            //debug("%s: %s", JSON.stringify(exchangeConfig), key);
            if(exchangeConfig.enabled){
                var Exchange = require('./' + exchangeConfig.driver);
                var exchange = new Exchange.Client(config);
                exchanges[key] = exchange;
                exchange.ee().on('orderBook', function(orderBook){
                    onOrderBook(exchange, orderBook)
                })
            }
        })
        
        var Airbex = require('airbex-client');
        client = new Airbex.RestClient(config.target);
        //exchanges['airbex'] = new Airbex.WebSocketClient(config.target);
    }
    
    init();
    

    
    this.getBalances = function(){
        var promises = [];
        _.each(exchanges, function(exchange){
            promises.push(exchange.getBalances());
        })
        return Q.all(promises)
        .then(function(results){
            debug(JSON.stringify(results, null, 4))
            return client.getBalances();
        })
        .then(function(balance){
            debug(JSON.stringify(balance, null, 4))
        })
    }

    this.monitorOrderBook = function(market){
        var promises = [];
        _.each(exchanges, function(exchange){
            debug("monitorOrderBook ")
            promises.push(exchange.monitorOrderBook(market));
        })
        return Q.all(promises)
        .then(function(){
            
        })
    }
    
    this.getDepth = function(market){
        var promises = [];
        _.each(exchanges, function(exchange){
            promises.push(exchange.getDepth(market));
        })
        return Q.all(promises)
        .then(function(){
            
        })
    }
    
    this.start = function() {
        var me = this;
        var promises = [];
        _.each(exchanges, function(exchange){
            promises.push(exchange.start());
        })
        return Q.all(promises)
        .then(function(results){
            return client.orderCancelAll(_market);
        })
        .then(function(results){
            return me.getBalances();
        })
    }

    this.stop = function stop() {
       
    }
    
}



module.exports = Liquiditer;