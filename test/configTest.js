/*global require*/
module.exports = function () {
    "use strict";
    var konphyg = require('konphyg')('./test/config');
    var configAll = konphyg.all();
    var config = configAll.config;
    return config;
};