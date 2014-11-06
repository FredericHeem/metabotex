"use strict";
var _ = require('underscore');
var async = require('async');
var Q = require("q");
var util = require('util');
var EventEmitter = require('events').EventEmitter;
var OrderBook = require('./OrderBook')
var log = require('./log')(__filename)
var debug = log.debug
var num = require('num');
var EventEmitter = require('events').EventEmitter;
var assert = require('assert');

function Liquiditer(config) {
    var me = this;
    var maxParallelOps = 16;
    var _provider;
    var _targetClient;
    var _orders = {}
    var _market = config.market;
    var _processing = false;
    var state = 'idle';
    var _orderBook;
    
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
            //debug("cancelOrder id: %s, price: %d amount: %d", orderId, price, amount);
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
                debug('cancelOrder done ');
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
                    //debug('sendOrders %s #%s placed', type, result.id);
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
                debug('sendAsk done ');
                deferred.resolve();
            }
        });
        return deferred.promise;
    };
    
    function filterAsks(asksOrig){
        var availableProviderQc = _provider.balance(config.quoteCurrency).available;
        if(_provider.config().overrideAvailableQc){
            availableProviderQc = _provider.config().overrideAvailableQc
        }
        //Target
        var availableTargetBc = _targetClient.balance(config.baseCurrency).balance;
        var maxAmountAskProviderBc = _orderBook.getAmountBaseFromQuote(availableProviderQc, asksOrig);
        
        
        var maxAmountAskBc = Math.min(maxAmountAskProviderBc, availableTargetBc);
        
        var asks = _orderBook.filterWithAmount('ask', maxAmountAskBc, asksOrig);
        //debug('filterAsks asks     ', asks);
        asks = _orderBook.addFees(asks, _provider.config().fee_ask);
        
        debug('filterAsks #asks %s, TargetBc %s,maxAmountAskProviderBc: %s', 
                asks.length, availableTargetBc, maxAmountAskProviderBc);
        //debug('filterAsks asks fees', asks);
        return asks;
    }
    
    function filterBids(bidsOrig){
        // Provider
        var availableProviderBc = _provider.balance(config.baseCurrency).available;
        if(_provider.config().overrideAvailableBc){
            availableProviderBc = _provider.config().overrideAvailableBc
        }
        
        var availableTargetQc = _targetClient.balance(config.quoteCurrency).balance;
        availableTargetQc = num(availableTargetQc).mul(num("0.98")).toString();
        var maxAmountBidProviderBc = _orderBook.getAmountBaseFromQuote(availableTargetQc, bidsOrig);
        
        var maxAmountBidBc = Math.min(maxAmountBidProviderBc, availableProviderBc);
        
        //debug('onOrderBookDiff b4 bids ', orderBook.bids);
        var bids = _orderBook.filterWithAmount('bid', maxAmountBidBc, bidsOrig);
        
        //debug('filterBids bids      ', bids);
        bids = _orderBook.addFees(bids, _provider.config().fee_bid);
        //debug('filterBids bids fees ', bids);
        
        debug('filterBids #bids %s, availableProviderBc %s,maxAmountBidProviderBc: %s', 
                bids.length, availableProviderBc, maxAmountBidProviderBc);
        return bids;
        //debug("diffBids:", diffBids);
        
    }
    function orderBookProcessed(orderBook){
        //debug('orderBookProcessed',orderBook )
        if(state !== 'running'){
            log.info("orderBookProcessed not running: ", state);
            return;
        }
        
        debug('orderBookProcessed: #bids %s, #asks %s', orderBook.bids.length, orderBook.asks.length);

        var bidsFiltered = [];
        var asksFiltered = [];
        try{
            var orderBookFilter = _orderBook.filterDepth(orderBook.bids, orderBook.asks);
            bidsFiltered = filterBids(orderBookFilter.bids);
            asksFiltered = filterAsks(orderBookFilter.asks)
        } catch(err){
            log.error("filter: ", JSON.stringify(err));
            throw new Error(err)
        }
        var diffBids = _orderBook.computeAddedRemoved(
                _provider.getOrderBook().bids, 
                bidsFiltered);
        
        var diffAsks = _orderBook.computeAddedRemoved(
                _provider.getOrderBook().asks, 
                asksFiltered);
        
        _provider.setOrderBook({bids:bidsFiltered, asks:asksFiltered});
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
        _targetClient.getBalances()
        .then(function(){
            
            diff = orderBookProcessed(orderBook);
            return Q.all([cancelOrder(diff.diffBids.removed),cancelOrder(diff.diffAsks.removed)])
        })
        .then(function(){
            return Q.all([sendOrders(diff.diffBids.added, 'bid'), sendOrders(diff.diffAsks.added, 'ask')])
        })
        .fail(function(err){
            log.error("onOrderBook ", err);
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

    function orderBookInit(){
        var configOrderBook = {
                baseCurrency:config.baseCurrency,
                quoteCurrency:config.quoteCurrency
        } 
        
        var currencies = _targetClient.get("currencies");
        var marketsInfo = _targetClient.get("marketsInfo");
        
        var baseCurrency = currencies[config.baseCurrency];
        assert(baseCurrency);
        debug("baseCurrency: ", baseCurrency);
        configOrderBook.baseScale = baseCurrency.scale;
        var quoteCurrency = currencies[config.quoteCurrency];
        debug("quoteCurrency: ", quoteCurrency);
        configOrderBook.quoteScale = quoteCurrency.scale;

        var marketInfo = marketsInfo[config.market];
        configOrderBook.bidMinVolume = marketInfo.bidminvolume;
        configOrderBook.askMinVolume = marketInfo.askminvolume;
        configOrderBook.bidmMinPrice = marketInfo.bidminprice;
        
        assert(marketInfo);

        _orderBook = new OrderBook(configOrderBook);
    }
    
    this.start = function() {
        debug("start");
        init();
        var me = this;
        return Q.all([_provider.start(), _targetClient.start()])
        .then(function(results){
            debug("start: cancel all orders");
            _targetClient.registerMessage("activity", onActivity);
            return _targetClient.orderCancelAll(_market);
        })
        .then(function(){
            return _targetClient.fetchCurrencies();
        })
        .then(function(currencies){
            debug("currencies: ", currencies);
        })
        .then(function(){
            return _targetClient.fetchMarketsInfo();
        })
        .then(function(marketsInfo){
            debug("marketInfo: ", marketsInfo[config.market]);
        })
        .then(function(){
            return me.getBalances();
        })
        .then(function(results){
            orderBookInit();
            _provider.monitorOrderBook(config.market);
            state = 'running';
        })
        .fail(function(error){
            log.error("started with error");
            me.emit('error', error)
            throw new Error(error)
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