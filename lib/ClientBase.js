"use strict";
var _ = require('underscore');
var Q = require("q");
var EventEmitter = require('events').EventEmitter;
var num = require('num');
var DepthUtils = require('./DepthUtils')
var log = require('./log')(__filename)
var debug = log.debug
var assert = require('assert')

function ClientBase(config) {
    var _ee = new EventEmitter();
    var _monitoringOrderBookHandle;
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
            _ee.emit("orderBook", depth);
            restartFetchOrderBook(me, market);
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
}

module.exports = ClientBase;