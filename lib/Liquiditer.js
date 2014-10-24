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
    var me = this;
    var exchanges = {};
    var maxParallelOps = 16;
    var _targetClient;
    var _targetClientBalances;
    var _orders = {}
    var _market = config.market;
    var _processing = false;
    
    function onError(error){
        log.error("onError", error);
        _targetClient.getBalances()
        .then(function(balances){
            debug(JSON.stringify(balances))
            process.exit();
        })
        
    }
    
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
        if(removed.length === 0){
            return;
        }
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
        if(bidasks.length === 0){
            return;
        }
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
            })
            .then(function(result){
                _orders[result.id] = pair;
                debug('sendOrders %s #%s placed', type, result.id);
                return callback()
            })
            .fail(function(err){
                log.error("sendOrders %s %s,for ", type, JSON.stringify(err), pair);
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
    
    function orderBookProcessed(exchange, orderBook){
        var balanceProvider = exchange.balance(config.quoteCurrency).available;
        var availableProviderQc = exchange.balance(config.quoteCurrency).available;
        if(exchange.config().overrideAvailableQc){
            availableProviderQc = exchange.config().overrideAvailableQc
        }
        
        var availableProviderBc = exchange.balance(config.baseCurrency).available;
        if(exchange.config().overrideAvailableBc){
            availableProviderBc = exchange.config().overrideAvailableBc
        }
        
        debug('onOrderBookDiff balances bc:%s, qc: %s', availableProviderBc, availableProviderQc);
        var availableTargetBc = _targetClient.getBalanceForCurrency(_targetClientBalances, config.baseCurrency).balance;
        var availableTargetQc = _targetClient.getBalanceForCurrency(_targetClientBalances, config.quoteCurrency).balance;
        availableTargetQc = num(availableTargetQc).mul(num("0.98")).toString();
        var maxAmountBidProviderBc = DepthUtils.getAmountBaseFromQuote(availableTargetQc, orderBook.bids);
        var maxAmountAskProviderBc = DepthUtils.getAmountBaseFromQuote(availableProviderQc, orderBook.asks);
        
        var maxAmountBidBc = Math.min(maxAmountBidProviderBc, availableProviderBc);
        var maxAmountAskBc = Math.min(maxAmountAskProviderBc, availableTargetBc);
        debug('onOrderBookDiff availableTargetQc %s, maxAmountBidBc: %s, maxAmountAskBc: %s',
                availableTargetQc, maxAmountBidBc, maxAmountAskBc);
        
        //debug('onOrderBookDiff b4 bids ', orderBook.bids);
        var bids = DepthUtils.filterWithAmount(maxAmountBidBc, orderBook.bids);
        
        //debug('onOrderBookDiff bids      ', bids);
        bids = DepthUtils.addFees(bids, exchange.config().fee_bid);
        //debug('onOrderBookDiff bids fees ', bids);
        var diffBids = DepthUtils.computeAddedRemoved(
                exchange.getOrderBook().bids, 
                bids);
        //debug("diffBids:", diffBids);
        
        var asks = DepthUtils.filterWithAmount(maxAmountAskBc, orderBook.asks);
        //debug('onOrderBookDiff asks     ', asks);
        asks = DepthUtils.addFees(asks, exchange.config().fee_ask);
        
        //debug('onOrderBookDiff asks fees', asks);
        
        var diffAsks = DepthUtils.computeAddedRemoved(
                exchange.getOrderBook().asks, 
                asks);
        
        //debug("diffAsks:", diffAsks);
        
        exchange.setOrderBook({bids:bids, asks:asks});
        var result = {diffBids:diffBids, diffAsks:diffAsks};
        //console.log("result: ", result);
        return result
    }
    
    function onOrderBook(me, exchange, orderBook){
        //debug('onOrderBookDiff');
        if(_processing){
            log.info("onOrderBook already processing")
            return;
        }
        _processing = true;
        
        var diff;
        me.getBalances()
        .then(function(){
            
            diff = orderBookProcessed(exchange, orderBook);
            return Q.all([cancelOrder(diff.diffBids.removed),cancelOrder(diff.diffAsks.removed)])
        })
        .then(function(){
            return Q.all([sendOrders(diff.diffBids.added, 'bid'), sendOrders(diff.diffAsks.added, 'ask')])
        })
        .fail(function(err){
            console.error("onOrderBook ", err);
            onError();
        })
        .fin(function(){
            _processing = false;
        })
        
    }
    
    function init(){
        _.each(config.exchanges, function(exchangeConfig, key){
            //debug("init %s: %s", key, JSON.stringify(exchangeConfig));
            if(exchangeConfig.enabled){
                var Exchange = require('./' + exchangeConfig.driver);
                var exchange = new Exchange.Client(exchangeConfig);
                exchanges[key] = exchange;
                exchange.ee().on('orderBook', function(orderBook){
                    onOrderBook(me, exchange, orderBook)
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
            //debug(JSON.stringify(results, null, 4))
            return _targetClient.getBalances();
        })
        .then(function(balances){
            debug(JSON.stringify(balances))
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
        debug("start");
        var promises = [];
        _.each(exchanges, function(exchange){
            promises.push(exchange.start());
        })
        debug("start: #exchanges: ", promises.length);
        return Q.all(promises)
        .then(function(results){
            debug("start: cancel all orders");
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