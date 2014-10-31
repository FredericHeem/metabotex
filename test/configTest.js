/*global require*/
module.exports = function (env) {
    "use strict";
    var konphyg = require('konphyg')('./test/config');
    console.log("test env :", env)
    if(env){
        //console.log(konphyg("config." + env))
        return konphyg("config." + env);
    } else {
        return konphyg.all();
    }
};