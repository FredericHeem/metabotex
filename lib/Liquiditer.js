"use strict";
var _ = require('underscore');
var async = require('async');
var Q = require("q");
var util = require('util');
var EventEmitter = require('events').EventEmitter;
var DepthUtils = require('./DepthUtils')
var log = require('./log')(__filename)
var debug = log.debug
var num = require('num');
var EventEmitter = require('events').EventEmitter;

function Liquiditer(config) {
    var me = this;
    var _exchanges = {};
    var maxParallelOps = 16;
    var _targetClient;
    var _targetClientBalances;
    var _orders = {}
    var _market = config.market;
    var _processing = false;
    
    log.info("Liquiditer");
    
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
            
            var orderId = findOrderId(ask);
            debug("cancelOrder id: %s, price: %d amount: %d", orderId, price, amount);
            if(!orderId){
                log.info("order %s not found for ", orderId, ask)
                return callback({name:"OrderNotFound"})
            }
            _targetClient.orderCancel(orderId)
            .then(function(){
                //debug('cancelOrder done');
                callback()
            }).fail(function(err){
                log.info("cancelOrder ", err);
                if(err.name === "OrderNotFound"){
                } else {
                    callback(err)
                }
            })
        },
        function(err) {
            if (err) {
                log.error("cancelOrder ", err);
                deferred.reject(err);
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
                if(result.id){
                    _orders[result.id] = pair;
                    debug('sendOrders %s #%s placed', type, result.id);
                    return callback()
                } else {
                    callback({name:"OrderError", result:result})
                }
                
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
        var availableTargetBc = _targetClientBalances[config.baseCurrency].balance;
        var availableTargetQc = _targetClientBalances[config.quoteCurrency].balance;
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
            //onError();
            me.emit('error', err)
        })
        .fin(function(){
            _processing = false;
        })
        
    }
    
    function onActivity(activity){
        log.error("onActivity: ");
    }
    
    function init(){
        _.each(config.exchanges, function(exchangeConfig, key){
            //debug("init %s: %s", key, JSON.stringify(exchangeConfig));
            debug("init exchange: ", exchangeConfig.driver)
            var Exchange = require('./' + exchangeConfig.driver);
            var exchange = new Exchange.Client(exchangeConfig);
            _exchanges[key] = exchange;
            exchange.ee().on('orderBook', function(orderBook){
                onOrderBook(me, exchange, orderBook)
            })
        })
        
        var Airbex = require('./Airbex');
        _targetClient = new Airbex.Client(config.target);
        
    }
    
    init();
    

    
    this.getBalances = function(){
        var promises = [];
        _.each(_exchanges, function(exchange){
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
        return Q.all(_.map(_exchanges, function(exchange){
            return exchange.monitorOrderBook(market);
        }))
        .then(function(){
            
        })
    }
    
    this.getDepth = function(market){
        var promises = [];
        _.each(_exchanges, function(exchange){
            promises.push(exchange.getDepth(market));
        })
        return Q.all(_.map(_exchanges, function(exchange){
            return exchange.getDepth(market);
        }))
        .then(function(){
            
        })
    }
    
    this.start = function() {
        debug("start");
        var promises =  _.map(_exchanges, function(exchange){
            return exchange.start();
        })
        promises.push(_targetClient.start());
        
        debug("start: #exchanges: ", promises.length);
        return Q.all(promises)
        .then(function(results){
            debug("start: cancel all orders");
            _targetClient.registerMessage("activity", onActivity);
            //_targetClient.registerMessage("/v1/markets", onActivity);
            
            return _targetClient.orderCancelAll(_market);
        })
        .then(function(results){
            return me.getBalances();
        })
    }

    this.stop = function stop() {
        debug("stop");
        var promises =  _.map(_exchanges, function(exchange){
            return exchange.stop();
        })
        promises.push(_targetClient.stop());
        
        debug("stop: #exchanges: ", promises.length);
        return Q.all(promises)
        .then(function(results){
            debug("stop: cancel all orders");
            return _targetClient.orderCancelAll(_market);
        })
        .then(function(results){
            debug("stop done");
        })
    }
    
}

util.inherits(Liquiditer, EventEmitter);


module.exports = Liquiditer;