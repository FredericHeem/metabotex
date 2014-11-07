var log = require('./log')(__filename)
, debug = log.debug
var fs = require("fs");
var LiquiditerApp = require('./LiquiditerApp');

var argv = require('yargs').argv;
var configFile = argv._[0];
if(!configFile){
    log.error("Please provide the config file")
    return 
}
debug("configFile ", configFile);
var config = (JSON.parse(fs.readFileSync(configFile, "utf8")));


var app = new LiquiditerApp(config);
app.start();

