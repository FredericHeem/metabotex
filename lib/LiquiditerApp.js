var log = require('./log')(__filename)
, debug = log.debug

var konphyg = require('konphyg')(__dirname + '/../test/config');
var configAll = konphyg.all();
var config = configAll.config;

var Liquiditer = require('./Liquiditer');
var liquiditer = new Liquiditer(config);

process.on('SIGINT', function() {
    log.info("Caught SIGINT stopping");
    process.exit();
});


liquiditer.start().then(function(){
    liquiditer.monitorOrderBook(config.market);
}, function(error){
    log.error(error);
})

