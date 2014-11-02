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
    var maxParallelOps = 16;
    var _provider;
    var _targetClient;
    var _orders = {}
    var _market = config.market;
    var _processing = false;
    var state = 'idle';
    
    log.info("Liquiditer");
    
    function findOrderId(bidAsk){
        var orderId;
        for (var orderId in _orders) {
            if(_.isEqual(_orders[orderId], bidAsk)){
                //debug("findOrderId bidAsk %s, id: %s", bidAsk, orderId);
                delete _orders[orderId];
                return orderId;
            }
        }
        log.info("findOrderId no order id for ", bidAsk)
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
                log.info("cancelOrder id: %s, err:", orderId, err);
                if(err.name === "OrderNotFound"){
                    callback();
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
    
    function orderBookProcessed(orderBook){
        //debug('orderBookProcessed',orderBook )
        if(state !== 'running'){
            log.info("orderBookProcessed not running: ", state);
            return;
        }
        
        debug('orderBookProcessed: #bids %s, #asks %s', orderBook.bids.length, orderBook.asks.length);

        // Provider
        var availableProviderBc = _provider.balance(config.baseCurrency).available;
        if(_provider.config().overrideAvailableBc){
            availableProviderBc = _provider.config().overrideAvailableBc
        }
        
        var availableProviderQc = _provider.balance(config.quoteCurrency).available;
        if(_provider.config().overrideAvailableQc){
            availableProviderQc = _provider.config().overrideAvailableQc
        }
        
        //Target
        debug('onOrderBookDiff balances provider bc:%s, qc: %s', availableProviderBc, availableProviderQc);
        var availableTargetBc = _targetClient.balance(config.baseCurrency).balance;
        var availableTargetQc = _targetClient.balance(config.quoteCurrency).balance;
        debug('onOrderBookDiff balances target   bc:%s, qc: %s', availableTargetBc, availableTargetQc);
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
        bids = DepthUtils.addFees(bids, _provider.config().fee_bid);
        //debug('onOrderBookDiff bids fees ', bids);
        var diffBids = DepthUtils.computeAddedRemoved(
                _provider.getOrderBook().bids, 
                bids);
        //debug("diffBids:", diffBids);
        
        var asks = DepthUtils.filterWithAmount(maxAmountAskBc, orderBook.asks);
        //debug('onOrderBookDiff asks     ', asks);
        asks = DepthUtils.addFees(asks, _provider.config().fee_ask);
        
        //debug('onOrderBookDiff asks fees', asks);
        
        var diffAsks = DepthUtils.computeAddedRemoved(
                _provider.getOrderBook().asks, 
                asks);
        
        //debug("diffAsks:", diffAsks);
        
        _provider.setOrderBook({bids:bids, asks:asks});
        var result = {diffBids:diffBids, diffAsks:diffAsks};
        //console.log("result: ", result);
        return result
    }
    
    function onOrderBook(me, orderBook){
        //debug('onOrderBookDiff');
        if(state !== 'running'){
            log.info("onOrderBook not running: ", state);
            return;
        }
        if(_processing){
            log.info("onOrderBook already processing")
            return;
        }
        _processing = true;
        
        var diff;
        me.getBalances()
        .then(function(){
            
            diff = orderBookProcessed(orderBook);
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
        debug("init provider: ", config.provider.driver)
        var Exchange = require('./' + config.provider.driver);
        _provider = new Exchange.Client(config.provider);
        _provider.ee().on('orderBook', function(orderBook){
            onOrderBook(me, orderBook)
        })
        
        var Airbex = require('./Airbex');
        _targetClient = new Airbex.Client(config.target);
        _targetClient.on('error', function(error){
            log.error("target: ", error);
            me.emit('error', error)
        })
    }
    
    this.getBalances = function(){
        debug("getBalances");
        return Q.all([_provider.getBalances(), _targetClient.getBalances()])
        .then(function(results){
            //debug(JSON.stringify(results, null, 4))
            debug("getBalances done");
        })
    }

    this.start = function() {
        debug("start");
        init();
        
        return Q.all([_provider.start(), _targetClient.start()])
        .then(function(results){
            debug("start: cancel all orders");
            _targetClient.registerMessage("activity", onActivity);
            return _targetClient.orderCancelAll(_market);
        })
        .then(function(results){
            return me.getBalances();
        })
        .then(function(results){
            _provider.monitorOrderBook(config.market);
            state = 'running';
        })
    }

    this.stop = function stop() {
        debug("stop");
        state = 'stopping';
        
        _provider.unmonitorOrderBook()
        
        return _targetClient.orderCancelAll(_market)
        .fin(function(){
            return Q.all([_provider.stop(), _targetClient.stop()])
        })
        .then(function(results){
            debug("stop done");
            state = 'stopped'
        })
    }
}

util.inherits(Liquiditer, EventEmitter);


module.exports = Liquiditer;