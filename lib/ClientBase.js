"use strict";
var _ = require('underscore');
var Q = require("q");
var EventEmitter = require('events').EventEmitter;
var num = require('num');
var DepthUtils = require('./DepthUtils')
var log = require('./log')(__filename)
var debug = log.debug
var assert = require('assert')
var BigNumber = require('bignumber.js');

function ClientBase(config) {
    var _ee = new EventEmitter();
    var _monitoringOrderBookHandle;
    var _marketInfo;
    debug("config: ", config);
    var _stateDepth = 'stopped';
    if(!config){
        throw new Error({name:"MisingConfig"})
    }
    this.config = function(){
        return config
    }
    
    this.ee = function(){
        return _ee
    }
    var _models = {};
    
    this.get = function(key){
        return _models[key];
    }
    this.set = function(key, value){
        //debug("set %s: %s", key, value);
        _models[key] = value;
    }
    
    this.balance = function (currency){
        assert(currency)
        var balances = this.get("balances");
        assert(balances);
        assert(balances[currency])
        //debug("balances", JSON.stringify(balances))
        debug("balance: ",JSON.stringify(balances[currency]))
        
        return balances[currency];
    }
    
    var _orderBookCurrent = {bids:[], asks:[]};
    
    this.setOrderBook = function(orderBookCurrent){
        _orderBookCurrent = orderBookCurrent
    }
    this.getOrderBook = function(){
        return _orderBookCurrent;
    }
    
    this.start = function(){
        log.info("start nothing")
    }
    
    this.stop = function(){
        log.info("stop");
        this.unmonitorOrderBook();
    }
    //_ee.on('orderBook', onOrderBook);
    
    function onOrderBook(depth){
        orderBookDiff(this, _orderBookCurrent, depth)
    }
    
    function orderBookDiff(me, orderBookCurrent, orderBookNew){
        //debug("oderBookCurrent ", orderBookCurrent);
        //debug("orderBookNew ", orderBookNew);

        var diffBids = DepthUtils.computeAddedRemoved(
                orderBookCurrent.bids, 
                orderBookNew.bids);
        var diffAsks = DepthUtils.computeAddedRemoved(
                orderBookCurrent.asks, 
                orderBookNew.asks);
        //console.log("diffBids ", diffBids);
        //console.log("diffAsks ", diffAsks);
        debug("orderBookDiff");
        _ee.emit('orderBookDiff', {diffBids:diffBids, diffAsks: diffAsks})
        //console.log(orderBookNew.bids);
        _orderBookCurrent = orderBookNew;
    }
    
    function restartFetchOrderBook(me, market){
        debug("restartFetchOrderBook: ", _stateDepth);
        if(_stateDepth === 'stopped'){
            log.error("restartFetchOrderBook stopped")
        } else {
            _monitoringOrderBookHandle = setTimeout(fetchOrderBook, 5e3, me, market);
        }
        
    }
    
    function fetchOrderBook(me, market){
        debug("fetchOrderBook state: ", _stateDepth);
        if(_stateDepth !== 'started'){
            log.error('fetchOrderBook not in good state')
            return;
        }
        
        me.getDepth(market)
        .then(function(depth){
            debug("fetchOrderBook #bids %s, asks %s", depth.bids.length, depth.asks.length);
            if(_stateDepth !== 'started'){
                log.error('fetchOrderBook not in good state')
                return;
            } else {
                _ee.emit("orderBook", depth);
                restartFetchOrderBook(me, market);
            }

        })
        .fail(function(error){
            log.error("fetchOrderBook error ", error);
            //_ee.emit("error", error)
            restartFetchOrderBook(me, market);
        })
    }
    this.monitorOrderBook = function(market){
        debug("monitorOrderBook: ", market);
        if(_monitoringOrderBookHandle){
            log.error("fetchOrderBook already monitoring");
            return
        }
        _stateDepth = 'started'
        fetchOrderBook(this, market);
    }
    this.unmonitorOrderBook = function(){
        debug("unmonitorOrderBook: ", _stateDepth);
        _stateDepth = 'stopped'
        if(_monitoringOrderBookHandle){
            clearTimeout(_monitoringOrderBookHandle);
            _monitoringOrderBookHandle = undefined;
        }
    }
    this.setMarketInfo = function(marketInfo){
        _marketInfo = marketInfo;
    }
    
    this.convertVolume = function(market, volume){
        var bnVolume = BigNumber(volume);
        if (bnVolume.isNaN()) {
            throw new Error('Invalid volume ' + volume)
        }
        var scale = _marketInfo[market].baseScale;
        if (!scale) {
            throw new Error('Invalid market ' + market)
        }
        
        var result = bnVolume.round(scale);
        return result.toString()
    }

    this.convertPrice = function(market, price, side){
        var bnPrice = BigNumber(price);
        if (bnPrice.isNaN()) {
            throw new Error('Invalid price ' + price)
        }
        var scale = _marketInfo[market].quoteScale;
        if (!scale) {
            throw new Error('Invalid market ' + market)
        }
        var roundMode;
        if(side === 'bid'){
            roundMode = BigNumber['ROUND_UP']
        } else if(side === 'ask'){
            roundMode = BigNumber['ROUND_DOWN']
        } else {
            throw new Error('Invalid side ' + side)
        }
        var result = bnPrice.round(scale, roundMode);
        return result.toString()
    }
}

module.exports = ClientBase;