'use strict';

/*
 * Created with @iobroker/create-adapter v1.16.0
 */

const utils = require('@iobroker/adapter-core');
const adapterName = (require('./package.json').name.split('.').pop() || '').toString();
const Nightscout = require('./lib/nightscout');
const request = require('request');
const crypto = require('crypto');

/**
 * The adapter instance
 * @type {ioBroker.Adapter}
 */
let adapter;
let URL;
let secret;

/**
 * Starts the adapter instance
 * @param {Partial<ioBroker.AdapterOptions>} [options]
 */
function startAdapter(options) {
    // Create the adapter and define its methods
    return adapter = utils.adapter(Object.assign({}, options, {
        name: adapterName,

        // The ready callback is called when databases are connected and adapter received configuration.
        // start here!
        ready: main, // Main method defined below for readability

        // is called when adapter shuts down - callback has to be called under any circumstances!
        unload: callback => {
            try {
                Nightscout.stopServer(callback);
            } catch (e) {
                callback();
            }
        },


        // Some message was sent to adapter instance over message box. Used by email, pushover, text2speech, ...
        // requires "common.message" property to be set to true in io-package.json
        message: obj => {
        	if (typeof obj === 'object' && obj.message) {
         		// expected
                // {
                //       path: '/api/v1/status.json',
                //       method: 'GET',
                //       body: json,
                // }
                const query = {
                    url: URL + obj.message.path,
                    method: (obj.message.method || 'GET').toUpperCase()
                };
                if (query.method !== 'GET') {
                    if (typeof obj.message.body === 'object') {
                        query.json = obj.message.body;
                    } else {
                        query.body = obj.message.body;
                    }
                }

                query.headers = {
                    'api-secret': secret
                };

                request(query, (err, state, body) =>
                    obj.callback && adapter.sendTo(obj.from, obj.command, body, obj.callback));
         	}
        },
    }));
}

function main() {
    const shasum = crypto.createHash('sha1');
    shasum.update(adapter.config.secret);
    secret = adapter.config.secret ? shasum.digest('hex') : '';

    URL = `http${adapter.config.secure ? 's' : ''}://${adapter.config.bind}:${adapter.config.port}`;

    if (!adapter.config.language) {
        adapter.getForeignObject('system.config', (err, obj) => {
            adapter.config.language = (obj && obj.common && obj.common.language) || 'en';
            Nightscout.startServer(adapter.config);
        });
    } else {
        Nightscout.startServer(adapter.config);
    }
}

// @ts-ignore parent is a valid property on module
if (module.parent) {
    // Export startAdapter in compact mode
    module.exports = startAdapter;
} else {
    // otherwise start the instance directly
    startAdapter();
}