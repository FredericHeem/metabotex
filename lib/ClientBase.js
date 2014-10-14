"use strict";
var _ = require('underscore');
var Q = require("q");
var EventEmitter = require('events').EventEmitter;
var num = require('num');
var DepthUtils = require('./DepthUtils')
var log = require('./log')(__filename)
var debug = log.debug

function ClientBase(config) {
    var _ee = new EventEmitter();
    debug("config: ", config);
    
    this.config = function(){
        return config
    }
    
    this.ee = function(){
        return _ee
    }
    
    var _orderBookCurrent = {bids:[], asks:[]};
    
    this.setOrderBook = function(orderBookCurrent){
        _orderBookCurrent = orderBookCurrent
    }
    this.getOrderBook = function(){
        return _orderBookCurrent;
    }
    
    this.start = function(){
        //log.info("start nothing")
    }
    
    //_ee.on('orderBook', onOrderBook);
    
    function onOrderBook(depth){
        orderBookDiff(this, _orderBookCurrent, depth)
    }
    
    function orderBookDiff(me, orderBookCurrent, orderBookNew){
        //debug("oderBookCurrent ", orderBookCurrent);
        //debug("orderBookNew ", orderBookNew);

        var diffBids = DepthUtils.computeAddedRemoved(
                orderBookCurrent.bids.slice(0, 3), 
                orderBookNew.bids.slice(0, 3));
        var diffAsks = DepthUtils.computeAddedRemoved(
                orderBookCurrent.asks.slice(0, 3), 
                orderBookNew.asks.slice(0, 3));
        //console.log("diffBids ", diffBids);
        //console.log("diffAsks ", diffAsks);
        debug("orderBookDiff");
        _ee.emit('orderBookDiff', {diffBids:diffBids, diffAsks: diffAsks})
        //console.log(orderBookNew.bids);
        _orderBookCurrent = orderBookNew;
    }
    
    function getOrderBook(me, market){
        console.log("getOrderBook ");
        me.getDepth(market)
        .then(function(depth){
            
            
            _ee.emit("orderBook", depth);
            setInterval(getOrderBook, 3e3, me, market)
        })
        .fail(function(error){
            console.log("getOrderBook error ", error);
            _ee.emit("error", error)
        })
    }
    this.monitorOrderBook = function(market){
        getOrderBook(this, market);
    }
}



module.exports = ClientBase;