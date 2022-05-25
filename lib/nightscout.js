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

///////////////////////////////////////////////////
// DB Connection setup and utils
///////////////////////////////////////////////////

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
    const sText = fs.readFileSync(source).toString('utf8');
    if (fs.existsSync(target)) {
        const tText = fs.readFileSync(target).toString('utf8');
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
        process.env.PORT = options.port || '1337';
        process.env.HOSTNAME = options.bind || '127.0.0.1';
        process.env.INSECURE_USE_HTTP = 'true';
        process.env.SECURE_HSTS_HEADER = options.secure ? 'true' : 'false';

        (options.envs || []).forEach(item => {
            if (item.name.trim()) {
                process.env[item.name.trim()] = item.value.trim();
            }
        });

        const path = require.resolve('nightscout') //'C:\\iot\\cgm-remote-monitor\\lib\\server\\server.js'
//            .replace('/lib/server/server.js', '')
//            .replace('\\lib\\server\\server.js', '')
            .replace('\\server.js', '')
            .replace('\\server.js', '');

        // copy all files from tmp directory into working directory
        !fs.existsSync('tmp') && fs.mkdirSync('tmp');
        !fs.existsSync('tmp/js') && fs.mkdirSync('tmp/js');

        fs.existsSync(path + '/tmp/js') && fs.readdirSync(path + '/tmp/js')
            .forEach(file =>
                updateFile(`${path}/tmp/js/${file}`, 'tmp/js/' + file.split(/[\\/]/).pop()));

        fs.existsSync(path + '/tmp/cacheBusterToken') && updateFile(path + '/tmp/cacheBusterToken', 'tmp/cacheBusterToken');
        fs.existsSync(path + '/tmp/randomString') && updateFile(path + '/tmp/randomString', 'tmp/randomString');

        const env = require(path + '/env')();
        const language = require(path + '/../language')();

        env.settings.language = options.language === 'zh-cn' ? 'zh_cn' : options.language;
        env.settings.timeFormat = options.timeFormat;
        env.settings.insecureUseHttp = !options.secure;
        env.settings.secureHstsHeader = options.secure;
        env.settings.customTitle = 'Nightscout ioBroker';

        language.set(env.settings.language);
        const boot = require(path + '/bootevent');
        boot(env, language)
            .boot(ctx => {
                const app = require(path + '/app')(env, ctx);
                let sendStartupAllClearTimer;

                server = LE.createServer(app, options, options.certificates, options.leConfig, adapter.log);

                server.listen(env.PORT, env.HOSTNAME, () =>
                    adapter.log.info(`http${options.secure ? 's' : ''} server listening on port ${env.PORT}`));

                if (ctx.bootErrors && ctx.bootErrors.length > 0) {
                    adapter.log.error(ctx.bootErrors.join(', '));
                    return reject(ctx.bootErrors);
                }

                ctx.bus.on('teardown', function serverTeardown () {
                    server.close();
                    sendStartupAllClearTimer && clearTimeout(sendStartupAllClearTimer);
                    ctx.store.client.close();
                });

                ///////////////////////////////////////////////////
                // setup socket io for data and message transmission
                ///////////////////////////////////////////////////
                const websocket = require(path + '/websocket')(env, ctx, server);

                ctx.bus.on('data-processed', function() {
                    websocket.update();
                });

                ctx.bus.on('notification', function(notify) {
                    websocket.emitNotification(notify);
                });

                // after startup if there are no alarms send all clear
                sendStartupAllClearTimer = setTimeout(() => {
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
