"use strict";
var _ = require('underscore');
var async = require('async');
var Q = require("q");
var EventEmitter = require('events').EventEmitter;
var DepthUtils = require('./DepthUtils')
var log = require('./log')(__filename)
var debug = log.debug
var num = require('num');

function Liquiditer(config) {
    
    var exchanges = {};
    var maxParallelOps = 16;
    var _targetClient;
    var _targetClientBalances;
    var _orders = {}
    var _market = config.market;
    var _processing = false;
    function findOrderId(bidAsk){
        var orderId;
        for (var orderId in _orders) {
            if(_.isEqual(_orders[orderId], bidAsk)){
                //debug("findOrderId bidAsk %s, id: %s", bidAsk, orderId);
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
            _targetClient.orderCancel(orderId)
            .then(function(){
                //debug('cancelOrder done');
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
                //debug('cancelOrder done ');
                deferred.resolve();
            }
        });
        return deferred.promise;
    }
    
    function sendOrders(bidasks, type) {
        debug("sendOrders %s %d", type, bidasks.length);
        var deferred = Q.defer();
        async.forEachLimit(bidasks, maxParallelOps,function(pair, callback) {
            var price = pair[0];
            var amount = pair[1];
            debug("sendOrders %s price: %d amount: %d", type, price, amount);
            _targetClient.order({
                market: config.market,
                type: type,
                price: price,
                amount: amount
            }).then(function(result){
                _orders[result.id] = pair;
                debug('sendOrders %s #%s placed', type, result.id);
                callback()
            }).fail(function(err){
                log.error("sendOrders %s", type, err);
                callback(err)
            })
        },
        function(err) {
            if (err) {
                log.error("sendOrders ", err);
                deferred.reject(err)
            } else {
                //debug('sendAsk done ', asks);
                deferred.resolve();
            }
        });
        return deferred.promise;
    };
    function sendAsks(asks) {
        debug("sendAsk #asks %d", asks.length);
        var deferred = Q.defer();
        async.forEachLimit(asks, maxParallelOps,function(ask, callback) {
            var price = ask[0];
            var amount = ask[1];
            debug("sendAsk price: %d amount: %d", price, amount);
            _targetClient.order({
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
                //debug('sendAsk done ', asks);
                deferred.resolve();
            }
        });
        return deferred.promise;
    };
    
    function onOrderBook(exchange, orderBook){
        //debug('onOrderBookDiff');
        if(_processing){
            log.info("onOrderBook already processing")
            return;
        }
        _processing = true;
        var availableProviderQc = "1000";
        var availableProviderBc = "20";
        var availableTargetBc = _targetClient.getBalanceForCurrency(_targetClientBalances, config.baseCurrency).available;
        var availableTargetQc = _targetClient.getBalanceForCurrency(_targetClientBalances, config.quoteCurrency).available;
        availableTargetQc = num(availableTargetQc).mul(num("0.99")).toString();
        var maxAmountBidProviderBc = DepthUtils.getTotalBuyAmountFromBalance(availableTargetQc, orderBook.bids);
        var maxAmountAskProviderBc = DepthUtils.getTotalBuyAmountFromBalance(availableProviderQc, orderBook.asks);
        
        var maxAmountBidBc = Math.min(maxAmountBidProviderBc, availableProviderBc);
        var maxAmountAskBc = Math.min(maxAmountAskProviderBc, availableTargetBc);
        debug('onOrderBookDiff availableTargetQc %s, maxAmountBidBc: %s, maxAmountAskBc: %s',
                availableTargetQc, maxAmountBidBc, maxAmountAskBc);
        
        //debug('onOrderBookDiff b4 bids ', orderBook.bids);
        var bids = DepthUtils.filterWithAmount(maxAmountBidBc, orderBook.bids);
        debug('onOrderBookDiff bids ', bids);

        var diffBids = DepthUtils.computeAddedRemoved(
                exchange.getOrderBook().bids, 
                bids);
        debug(diffBids);
        
        var asks = DepthUtils.filterWithAmount(maxAmountAskBc, orderBook.asks);
        debug('onOrderBookDiff asks ', asks);
        
        var diffAsks = DepthUtils.computeAddedRemoved(
                exchange.getOrderBook().asks, 
                asks);
        
        debug(diffAsks);
        
        exchange.setOrderBook({bids:bids, asks:asks});
        
        Q.all([cancelOrder(diffBids.removed),cancelOrder(diffAsks.removed)])
        .then(function(){
            return Q.all([sendOrders(diffBids.added, 'bid'), sendOrders(diffAsks.added, 'ask')])
        })
        .fail(function(err){
            log.error("onOrderBook ", err)
        })
        .fin(function(){
            _processing = false;
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
        _targetClient = new Airbex.RestClient(config.target);
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
            return _targetClient.getBalances();
        })
        .then(function(balances){
            debug(JSON.stringify(balances, null, 4))
            _targetClientBalances = balances;
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
            return _targetClient.orderCancelAll(_market);
        })
        .then(function(results){
            return me.getBalances();
        })
    }

    this.stop = function stop() {
       
    }
    
}



module.exports = Liquiditer;