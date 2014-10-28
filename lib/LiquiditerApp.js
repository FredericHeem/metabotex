var log = require('./log')(__filename)
, debug = log.debug


var Liquiditer = require('./Liquiditer');

var konphyg = require('konphyg')(__dirname + '/../test/config');
var configAll = konphyg.all();
var config = configAll.config;





function LiquiditerApp(){
    var _liquiditer;
    var inError = false;
    var me = this;
    function onError(){
        debug("onError: restart in 10 sec");
        if(!inError){
            inError = true
            _liquiditer.stop()
            .fin(function(){
                debug("onError: stopped");
                delete _liquiditer;
                setTimeout(me.start, 10e3);
            })
        } else {
            debug("onError: already in error");
            setTimeout(start, 10e3);
        }
    }
    this.start = function(){
        debug("start");
        inError = false;
        _liquiditer = new Liquiditer(config);
        _liquiditer.on('error', onError);
        _liquiditer.start()
        .then(function(){
            _liquiditer.monitorOrderBook(config.market);
        }, function(error){
            console.log(error);
            log.error(error);
            onError();
        })
        
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

var app = new LiquiditerApp();
app.start();

