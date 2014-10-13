"use strict";
var _ = require('underscore');
var Q = require("q");
var EventEmitter = require('events').EventEmitter;
var log = require('./log')(__filename)
var debug = log.debug

function ClientBase(options) {
    var _ee = new EventEmitter();
    
    this.ee = function(){
        return _ee
    }
    
    this._orderBookCurrent = {bids:[], asks:[]};
    
    this.start = function(){
        //log.info("start nothing")
    }
    
    function orderBookSideDiff(currentBidAsks, newBidAsks){
        //console.log("currentBidAsks ");
        //console.log(currentBidAsks);
        //console.log("newBidAsks ");
        //console.log(newBidAsks);
        
        var added = _.filter(newBidAsks, function(newItem){
            return !_.find(currentBidAsks,function(oldItem){
                return _.isEqual(oldItem,newItem);
            })
        })

        //console.log("added ", added.length);
        //console.log(added);
        var removed = _.filter(currentBidAsks, function(oldItem){
            return !_.find(newBidAsks,function(newItem){
                return _.isEqual(oldItem,newItem);
            })
        })

        //console.log("removed ", removed.length);
        //console.log(removed);
        return {added:added, removed:removed}
    }
    
    function orderBookDiff(me, orderBookCurrent, orderBookNew){
        //console.log("oderBookCurrent ", oderBookCurrent);
        //console.log("orderBookNew ", orderBookNew);
        var diffBids = orderBookSideDiff(orderBookCurrent.bids.slice(0, 3), orderBookNew.bids.slice(0, 3));
        var diffAsks = orderBookSideDiff(orderBookCurrent.asks.slice(0, 3), orderBookNew.asks.slice(0, 3));
        //var diffAsks = orderBookSideDiff(orderBookCurrent.asks, orderBookNew.asks);
        console.log("diffBids ", diffBids);
        console.log("diffAsks ", diffAsks);
        _ee.emit('orderBookDiff', {diffBids:diffBids, diffAsks: diffAsks})
        //console.log(orderBookNew.bids);
        me._orderBookCurrent = orderBookNew;
    }
    
    function getOrderBook(me, market){
        console.log("getOrderBook ");
        me.getDepth(market)
        .then(function(depth){
            orderBookDiff(me, me._orderBookCurrent, depth)
            
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