/*global describe, it, before, after*/
var assert = require('assert');
var request = require('supertest');
var async = require('async');
var _ = require('underscore');
var debug = require('debug')('WebSocket');
var num = require('num');

function orderAndCancel(api, param, done){
    var oid;
    api.order(param)
    .then(function(result){
        assert(result)
        assert(result.oid)
        oid = result.oid
    })
    .delay(7e3)
    .then(function(){
        return api.orderCancel(oid);
    })
   .then(done)
   .fail(done)
}



module.exports = {
        orderAndCancel:orderAndCancel
};