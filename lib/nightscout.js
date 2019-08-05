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

const fs    = require('fs');
const utils = require('@iobroker/adapter-core'); // Get common adapter utils
const LE    = require(utils.controllerDir + '/lib/letsencrypt.js');

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
function updateFile(source, target) {
    const sText = fs.readFileSync(source);
    if (fs.existsSync(target)) {
        const tText = fs.readFileSync(target);
        if (tText === sText) {
            return;
        }
    }
    fs.writeFileSync(target, sText);
}

function startServer(adapter) {
    return new Promise((resolve, reject) => {
        const options = adapter.config;
        process.env.MONGO_CONNECTION = options.mongo;
        process.env.ENABLE = options.enabled;
        process.env.PUMP_FIELDS = options.pumpFields;
        process.env.AUTH_DEFAULT_ROLES = options.allowUnauthorized ? 'readable' : 'denied';
        process.env.DISPLAY_UNITS = options.units || 'mg/dl';
        process.env.API_SECRET = options.secret || '';
        process.env.PORT = options.port || 1337;
        process.env.HOSTNAME = options.bind || '127.0.0.1';
        process.env.INSECURE_USE_HTTP = true;
        process.env.SECURE_HSTS_HEADER = !!options.secure;

        (options.envs || []).forEach(item => {
            if (item.name.trim()) {
                process.env[item.name.trim()] = item.value.trim();
            }
        });

        const path = require.resolve('nightscout').replace('/server.js', '').replace('\\server.js', '');

        // copy all files from tmp directory into working directory
        !fs.existsSync('tmp') && fs.mkdirSync('tmp');
        !fs.existsSync('tmp/js') && fs.mkdirSync('tmp/js');
        fs.readdirSync(path + '/tmp/js')
            .forEach(file =>
                updateFile(path + '/tmp/js/' + file, 'tmp/js/' + file.split(/[\\/]/).pop()));
        updateFile(path + '/tmp/cacheBusterToken', 'tmp/cacheBusterToken', );

        const env = require(path + '/env')();
        const language = require(path + '/lib/language')();

        env.settings.language = options.language === 'zh-cn' ? 'zh_cn' : options.language;
        env.settings.timeFormat = options.timeFormat;
        env.settings.insecureUseHttp = !options.secure;
        env.settings.secureHstsHeader = options.secure;
        env.settings.customTitle = 'Nightscout ioBroker';

        language.set(env.settings.language);

        const PORT = env.PORT;
        const HOSTNAME = env.HOSTNAME;

        require(path + '/lib/server/bootevent')(env, language).boot(ctx => {
            const app = require(path + '/app')(env, ctx);

            server = LE.createServer(app, options, options.certificates, options.leConfig, adapter.log);

            server.listen(PORT, HOSTNAME, () =>
                adapter.log.info('http' + (options.secure ? 's' : '') + ' server listening on port ' + PORT));

            if (ctx.bootErrors && ctx.bootErrors.length > 0) {
                adapter.log.error(ctx.bootErrors.join(', '));
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
