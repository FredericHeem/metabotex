"use strict";
var Q = require("q");
var _ = require('underscore');
var num = require('num');
var log = require('./log')(__filename)
var debug = log.debug


function getAmountBaseFromQuote(balanceQc, asks){
    //debug("getAmountBaseFromQuote ", asks)
    var total = num(0).set_precision(8);
    var remaining = num(balanceQc).set_precision(5);
    _.some(asks, function(ask){
        var price = num(ask[0]);
        var volume = num(ask[1]);
        var partialAmount = price.mul(volume);
        if(remaining.gt(partialAmount)){
            total = total.add(volume);
            remaining = remaining.sub(partialAmount);
            /*debug("remaining %s, amount %s, price %s, total %s",
                    remaining.toString(), volume.toString(), price.toString(), total.toString());*/
            return false;
        } else {
            total = total.add(remaining.div(price));
            remaining = num(0);
            /*debug("final remaining %s, total ", remaining.toString(), total.toString());*/
            return true;
        }
        
    });
    //debug("can buy %s with %s",total.toString(), balanceQc);
    return total.toString();
}

function filterWithAmount(total, asks){
    var asksFiltered = [];
    var minVolume = "0.001";
    if(num(total).lt(num(minVolume))){
        debug("filterWithAmount total too low: ", total)
        return asksFiltered;
    }
    var remainingAmount = num(total)
    _.some(asks, function(ask){
        var volume = num(ask[1]);
        
        if(volume.lt(num(minVolume))){
            debug("filterWithAmount amount too low: ", minVolume)
            return false;
        }
        if(remainingAmount.gt(volume)){
            remainingAmount = remainingAmount.sub(volume);
            //debug("remaining %s, amount %s, total %s",
            //        remainingAmount.toString(), volume.toString(), total);
            asksFiltered.push(ask)
            return false;
        } else {
            if(remainingAmount.lt(num(minVolume))){
                debug("filterWithAmount remainingAmount too low: ", minVolume)
            } else {
                asksFiltered.push([ask[0], remainingAmount.toString()])
            }
            //debug("final remaining ", remainingAmount.toString());
            return true;
        }
        
    });
    return asksFiltered;
}

function addFees(quotes, fee){
    var quotesWithFee = _.map(quotes, function(quote){
        var price = num(quote[0]).set_precision(5).mul(num(1).add(num(fee).set_precision(5).div(num("100"))));
        price.set_precision(5)
        return [price.toString(), quote[1]]
    });
    
    return quotesWithFee;
}

function computeAddedRemoved(currentBidAsks, newBidAsks){
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
module.exports = {
        addFees:addFees,
        getAmountBaseFromQuote:getAmountBaseFromQuote,
        computeAddedRemoved:computeAddedRemoved,
        filterWithAmount:filterWithAmount
};