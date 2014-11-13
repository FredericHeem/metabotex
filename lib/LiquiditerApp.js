var log = require('./log')(__filename)
, debug = log.debug
var fs = require("fs");
var Liquiditer = require('./Liquiditer');

function LiquiditerApp(config){
    var _liquiditer;
    var inError = false;
    var me = this;
    var errorCount = 0;
    var maxError = 10;
    if(!config){
        throw new Error({name:"MisingConfig"})
    }
    log.info("LiquiditerApp");
    // log.info("LiquiditerApp: ", config)
    
    function onError(){
        debug("onError: restart in 2 sec");
        if(!inError){
            inError = true
            _liquiditer.stop()
            .fin(function(){
                debug("onError: stopped");
                delete _liquiditer;
                
                errorCount++;
                if(errorCount > maxError){
                    log.error("Too much error, exit");
                    process.exit();
                } else {
                    setTimeout(me.start, 2e3);
                }
            })
        } else {
            debug("onError: already in error");
        }
    }
    
    this.start = function(){
        debug("start");
        inError = false;
        _liquiditer = new Liquiditer(config);
        _liquiditer.on('error', onError);
        _liquiditer.start()
//        .fail(function(error){
//            //console.log(error);
//            log.error("start: ", error.toSting());
//            onError();
//        })
    }
    
    this.stop = function(){
        debug("stop");
        return _liquiditer.stop();
    }
    
    process.on('SIGINT', function() {
        log.info("Caught SIGINT stopping");
        me.stop().fin(function(){
            log.info("process exit");
            process.exit();
        })
    });
}

module.exports = LiquiditerApp;
