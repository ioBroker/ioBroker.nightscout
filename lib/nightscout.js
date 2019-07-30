/*
* cgm-remote-monitor - web app to broadcast cgm readings
* Copyright (C) 2014 Nightscout contributors.  See the COPYRIGHT file
* at the root directory of this distribution and at
* https://github.com/nightscout/cgm-remote-monitor/blob/master/COPYRIGHT
*
* This program is free software: you can redistribute it and/or modify
* it under the terms of the GNU Affero General Public License as published
* by the Free Software Foundation, either version 3 of the License, or
* (at your option) any later version.
*
* This program is distributed in the hope that it will be useful,
* but WITHOUT ANY WARRANTY; without even the implied warranty of
* MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
* GNU Affero General Public License for more details.
*
* You should have received a copy of the GNU Affero General Public License
* along with this program.  If not, see <http://www.gnu.org/licenses/>.
*/

// Description: Basic web server to display data from Dexcom G4.  Requires a database that contains
// the Dexcom SGV data.
'use strict';

// File source was copied from here: https://github.com/nightscout/cgm-remote-monitor/blob/master/server.js

const fs = require('fs');

///////////////////////////////////////////////////
// setup http server
///////////////////////////////////////////////////
let server;

function stopServer(cb) {
    if (server) {
        // Close the server
        server.close(cb);
    } else {
        cb && cb();
    }
}

function startServer(options) {
    return new Promise((resolve, reject) => {
        // MONGO_CONNECTION=mongodb://localhost:27017/iobroker
        // ENABLE=careportal basal
        // DISPLAY_UNITS=mg/dl
        // API_SECRET=12345678901234
        // INSECURE_USE_HTTP=true
        // SECURE_HSTS_HEADER=false
        // TIME_FORMAT=24
        process.env.MONGO_CONNECTION = options.mongo;
        process.env.ENABLE = options.enabled;
        process.env.DISPLAY_UNITS = options.units || 'mg/dl';
        process.env.API_SECRET = options.secret || '';
        process.env.PORT = options.port || 1337;
        process.env.HOSTNAME = options.bind || '127.0.0.1';

        if (!options.secure) {
            process.env.INSECURE_USE_HTTP = true;
            process.env.SECURE_HSTS_HEADER = false;
        } else {
            process.env.INSECURE_USE_HTTP = false;
            process.env.SECURE_HSTS_HEADER = true;
        }

        const path = require.resolve('nightscout').replace('/server.js', '').replace('\\server.js', '');

        if (!fs.existsSync('tmp')) {
            fs.mkdirSync('tmp');
            fs.mkdirSync('tmp/js');
            fs.readdirSync(path + '/tmp/js')
                .forEach(file =>
                    fs.writeFileSync('tmp/js' + file.split(/[\\\/]/).pop(), fs.readFileSync(path + '/tmp/js/' + file)));
            fs.writeFileSync('tmp/cacheBusterToken', fs.readFileSync(path + '/tmp/cacheBusterToken'));
        }

        const env = require(path + '/env')();
        const language = require(path + '/lib/language')();

        env.settings.language = options.language === 'zh-cn' ? 'zh_cn' : options.language;
        env.settings.timeFormat = options.timeFormat;
        env.settings.insecureUseHttp = !options.secure;
        env.settings.secureHstsHeader = options.secure;
        env.settings.customTitle = 'Nightscout ioBroker';

        const translate = language.set(env.settings.language).translate;
        const PORT = env.PORT;
        const HOSTNAME = env.HOSTNAME;

        require(path + '/lib/server/bootevent')(env, language).boot(ctx => {
            const app = require(path + '/app')(env, ctx);
            const transport = env.ssl ? require('https') : require('http');
            server = env.ssl ? transport.createServer(env.ssl, app) : transport.createServer(app);
            server.listen(PORT, HOSTNAME);
            console.log(translate('Listening on port'), PORT, HOSTNAME);

            if (ctx.bootErrors && ctx.bootErrors.length > 0) {
                return reject(ctx.bootErrors);
            }

            ///////////////////////////////////////////////////
            // setup socket io for data and message transmission
            ///////////////////////////////////////////////////
            const websocket = require(path + '/lib/server/websocket')(env, ctx, server);

            ctx.bus.on('data-processed', () => websocket.update());

            ctx.bus.on('notification', notify => websocket.emitNotification(notify));

            // after startup if there are no alarms send all clear
            setTimeout(() => {
                const alarm = ctx.notifications.findHighestAlarm();
                if (!alarm) {
                    ctx.bus.emit('notification', {
                        clear: true,
                        title: 'All Clear',
                        message: 'Server started without alarms'
                    });
                }
            }, 20000);

            resolve(server);
        });
    });
}

module.exports = {
    startServer,
    stopServer
};
