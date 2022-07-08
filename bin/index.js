'use strict';

const config = require('./../config');

if (process.argv.length > 2 && process.argv[process.argv.length - 1] === 'test') {
    console.log('\nsome test case');
} else {
    /**
     * Module dependencies.
     */

    const app = require('../app');
    const debug = require('debug')('myapp:server');
    const http = require('http');

    /**
     * Normalize a port into a number, string, or false.
     */

    const normalizePort = function(val) {
        let port = parseInt(val, 10);

        if (isNaN(port)) {
            // named pipe
            return val;
        }

        if (port >= 0) {
            // port number
            return port;
        }

        return false;
    };

    /**
     * Event listener for HTTP server "error" event.
     */

    const onError = function(error) {
        if (error.syscall !== 'listen') {
            throw error;
        }

        const bind = typeof port === 'string' ?
            'Pipe ' + port :
            'Port ' + port;

        // handle specific listen errors with friendly messages
        switch (error.code) {
            case 'EACCES':
                console.error(bind + ' requires elevated privileges');
                process.exit(1);
                break;
            case 'EADDRINUSE':
                console.error(bind + ' is already in use');
                process.exit(1);
                break;
            default:
                throw error;
        }
    };

    /**
     * Event listener for HTTP server "listening" event.
     */

    const onListening = function() {
        const addr = server.address();
        const bind = typeof addr === 'string' ?
            'pipe ' + addr :
            'port ' + addr.port;
        debug('Listening on ' + bind);
    };

    //Create HTTP server.
    const server = http.createServer(app);

    //Get port from environment and store in Express.
    const port = normalizePort(config.port);
    app.set('port', port);
    console.log(config.appName, 'running on port', port);

    server.listen(port);
    server.on('error', onError);
    server.on('listening', onListening);

    // for HTTPs
    //Create HTTPs server.

    /*var https = require('https');
    var fs = require('fs');    
    var options = {
       cert: fs.readFileSync('/etc/letsencrypt/live/api.delivernow.com.au/fullchain.pem', 'utf8'),
       key: fs.readFileSync('/etc/letsencrypt/live/api.delivernow.com.au/privkey.pem', 'utf8'),
    };
    const httpsServer = https.createServer(options, app);    //Get port from environment and store in Express.
    const httpsport = normalizePort(9011);
    app.set('port', httpsport);
    logger(config.appName, 'running on port', httpsport);    httpsServer.listen(httpsport);
    httpsServer.on('error', onError);
    httpsServer.on('listening', onListening);*/


    //end HTTPs
}