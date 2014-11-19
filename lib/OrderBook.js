"use strict";
var Q = require("q");
var _ = require('underscore');
var num = require('num');
var log = require('./log')(__filename)
var debug = log.debug
var BigNumber = require('bignumber.js');

function OrderBook(config){
    debug("OrderBook:", config)
    var _baseCurrency = config.baseCurrency;
    var _quoteCurrency = config.quoteCurrency;
    
    function totalVolume(quotes){
        var total = BigNumber(0);
        quotes.forEach(function(quote){
            total = total.plus(quote[1])
        })
        return total.toString()
    }
    
    function filterIsNumber(side, quotes){
        var quotesFiltered = [];
        _.each(quotes, function(quote){
            var price = BigNumber(quote[0]);
            var amount = BigNumber(quote[1]);
            if(price.isNaN()){
                throw new ({name:"InvalidPrice", price:quote[0]})
            }
            if(amount.isNaN()){
                throw new ({name:"InvalidAmount", amount:quote[1]})
            }
            
            if(side === 'bid'){
                if(price.lt(config.bidMinPrice)){
                    log.info("bid price %s lower than minimum %s", price.toString(), config.bidMinPrice);
                    return;
                }
                if(amount.lt(config.bidMinVolume)){
                    log.info("bid volume %s lower than minimum %s", amount.toString(), config.bidMinVolume);
                    return;
                }
            } else {
                if(amount.lt(config.askMinVolume)){
                    log.info("ask volume %s lower than minimum %s", amount.toString(), config.askMinVolume);
                    return;
                }
                if(price.gt(config.askMaxPrice)){
                    log.info("ask price %s greater than maximum %s", price.toString(), config.askMaxPrice);
                    return;
                }
            }
            quotesFiltered.push(quote);
        })
        return quotesFiltered;
    }
    
    this.filterDepth = function(bids, asks){
        if(!bids || bids.length == 0){
            log.error("invalid bids");
            throw new Error({name:"InvalidBids"})
        }
        if(!asks || asks.length == 0){
            log.error("invalid bids");
            throw new Error({name:"InvalidAsk"})
        }
        
        var bestBid = bids[0];
        var bestBidPrice = BigNumber(bestBid[0]); 
        var bestAsk = asks[0];
        var bestAskPrice = BigNumber(bestAsk[0]);
        
        if(bestBidPrice.gte(bestAskPrice)){
            log.error("bids %s greater than ask %s", bestBidPrice.toString(), bestAskPrice.toString());
            throw new Error({message:"Bids greater then asks"})
        }
        
        bids = filterIsNumber('bid', bids);
        asks = filterIsNumber('ask', asks);
        
        debug("filterDepth %s %s %s #bids, %s %s %s #asks, %s/%s %s spread %s", 
                totalVolume(bids), _baseCurrency, bids.length, totalVolume(asks), _baseCurrency, asks.length,
                bestBidPrice.toString(), bestAskPrice.toString(), _quoteCurrency, bestAskPrice.minus(bestBidPrice).toString());
        return {
            bids:bids, asks:asks
        }
    }
    this.getAmountBaseFromQuote = function(balanceQc, asks){
        //debug("getAmountBaseFromQuote quote: %s  ", balanceQc)
        var total = num(0).set_precision(config.baseScale);
        var remaining = num(balanceQc).set_precision(config.quoteScale);
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
                total = total.add(remaining.div(price)).set_precision(config.baseScale);
                remaining = num(0);
                //debug("final remaining %s, total ", remaining.toString(), total.toString());
                return true;
            }
            
        });
        debug("can buy %s %s with %s %s",total.toString(), config.baseCurrency, balanceQc, config.quoteCurrency);
        return total.toString();
    }
    
    this.filterWithAmount = function(side, total, asks){
        var asksFiltered = [];
        var minVolume = config.bidMinVolume;
        
        if(num(total).lt(num(minVolume))){
            debug("filterWithAmount %s, total too low: %s, min: ", side, total, config.bidMinVolume)
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
    this.addFees = function(quotes, fee){
        var quotesWithFee = _.map(quotes, function(quote){
            var multiplier = num("100").set_precision(config.quoteScale).add(num(fee)).div(num("100"));
            var price = num(quote[0]).set_precision(config.quoteScale).mul(multiplier);
            price.set_precision(config.quoteScale)
            return [price.toString(), quote[1]]
        });
        
        return quotesWithFee;
    }
    
    this.computeAddedRemoved = function(currentBidAsks, newBidAsks){
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
}

module.exports = OrderBook;