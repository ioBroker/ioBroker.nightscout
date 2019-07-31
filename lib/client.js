const io = require('socket.io-client');
const https = require('https');

function NightscoutClient(adapter, URL, secretHash) {
    if (adapter.config.secure) {
        https.globalAgent.options.rejectUnauthorized = false;
    }

    this.URL = URL || `http${adapter.config.secure ? 's' : ''}://${adapter.config.bind}:${adapter.config.port}`;
    
    if (!secretHash && adapter.config.secret) {
        const shaSum = require('crypto').createHash('sha1');
        shaSum.update(adapter.config.secret);
        secretHash = shaSum.digest('hex');
    } else {
        secretHash = secretHash || null;
    }
    
    this.secretHash = secretHash;

    this.nsSocket = io(this.URL, {
        path: '/socket.io',
        agent: adapter.config.secure ? https.globalAgent : undefined
    });

    this.nsSocket.on('disconnect', () => {
        adapter.log.debug('[CLIENT] own client disconnected');
    });
    this.nsSocket.on('connect', () => {
        adapter.log.debug('[CLIENT] own client connected');
        this.nsSocket.emit('authorize', {
            client: 'iobroker',
            secret: this.secretHash,
            history: 48
        });
    });
    
    this.nsSocket.on('notification', data => {
        adapter.log.debug('[CLIENT] notification: ' + JSON.stringify(data));
        if (data) {
            const ts = new Date(data.timestamp).getTime();
            adapter.setState('data.notification', {ts, ack: true, val: data.title + ' ' + data.message});
        }
    });
    this.nsSocket.on('announcement', data =>
        adapter.log.info('[CLIENT] announcement: ' + data));

    this.nsSocket.on('alarm', data =>
        adapter.setState('data.alarm', data, true));

    this.nsSocket.on('urgent_alarm', data =>
        adapter.setState('data.urgentAlarm', data, true));
    
    this.nsSocket.on('dataUpdate', dataUpdate => {
        // dataUpdate = {
        //     "delta": true,
        //     "lastUpdated": 1564565851622,
        //     "sgvs": [{"mgdl": 204, "mills": 1564565804977, "direction": "SingleUp", "scaled": 204}],
        //     "devicestatus": [{
        //         "_id": "5d41615123456303158346",
        //         "created_at": "2019-07-31T09:37:20.000Z",
        //         "device": "medtronic-600://1234",
        //         "pump": {
        //             "battery": {"percent": 100},
        //             "clock": "2019-07-31T11:37:20+02:00",
        //             "iob": {"bolusiob": 3.6, "timestamp": "Jul 31, 2019 11:37:20 AM"},
        //             "reservoir": 96,
        //             "status": {"bolusing": false, "status": "normal :::. 10h45m", "suspended": false}
        //         },
        //         "utcOffset": 120,
        //         "mills": 1564565840000,
        //         "uploader": {"battery": 80, "value": 80, "display": "80%", "level": 75},
        //         "clockMills": 1564565840000,
        //         "data": {
        //             "level": -3,
        //             "clock": {
        //                 "value": "2019-07-31T09:37:20.000Z",
        //                 "label": "Last Clock",
        //                 "display": "1m ago",
        //                 "level": -3
        //             },
        //             "reservoir": {"value": 96, "label": "Reservoir", "display": "96.0U", "level": -3},
        //             "extended": null,
        //             "status": {"value": "normal :::. 10h45m", "display": "normal :::. 10h45m", "label": "Status"},
        //             "battery": {"value": 100, "unit": "percent", "label": "Battery", "display": "100%", "level": -3},
        //             "device": {"label": "Device", "display": "medtronic-600://1234"},
        //             "title": "Pump Status"
        //         }
        //     }]
        // };

        adapter.log.debug('[CLIENT] dataUpdate: ' + JSON.stringify(dataUpdate));
        try {
            adapter.setState('data.rawUpdate', JSON.stringify(dataUpdate), true);
            if (dataUpdate) {
                let ts = dataUpdate.lastUpdate || Date.now();
                if (dataUpdate.lastUpdate) {
                    adapter.setState('data.lastUpdate', dataUpdate.lastUpdated, true);
                }

                if (dataUpdate.devicestatus && dataUpdate.devicestatus.length) {
                    const status = dataUpdate.devicestatus.pop();
                    adapter.setState('data.device', status.device, true);

                    if (status.pump) {
                        adapter.setState('data.clock',       {ts, ack: true, val: new Date(status.pump.clock).getTime()});
                        adapter.setState('data.reservoir',   {ts, ack: true, val: status.pump.reservoir});

                        status.pump.iob     && adapter.setState('data.bolusiob',    {ts, ack: true, val: status.pump.iob.bolusiob});
                        status.pump.battery && adapter.setState('data.pumpBattery', {ts, ack: true, val: status.pump.battery.percent});

                        if (status.pump.status) {
                            adapter.setState('data.bolusing',    {ts, ack: true, val: status.pump.status.bolusing});
                            adapter.setState('data.status',      {ts, ack: true, val: status.pump.status.status});
                            adapter.setState('data.suspended',   {ts, ack: true, val: status.pump.status.suspended});
                        }
                    }

                    status.uploader && adapter.setState('data.uploaderBattery', status.uploader.battery, true);
                }
                if (dataUpdate.sgvs && dataUpdate.sgvs.length) {
                    const sgv = dataUpdate.sgvs.pop();
                    adapter.setState('data.mgdl',          {ts: sgv.mills, ack: true, val: sgv.mgdl});
                    adapter.setState('data.mgdlScaled',    {ts: sgv.mills, ack: true, val: sgv.scaled});
                    adapter.setState('data.mgdlDirection', {ts: sgv.mills, ack: true, val: sgv.direction});
                }
            }
        } catch (error) {
            adapter.log.error('[CLIENT] Parse Error: ' + error);
        }
    });

    this.close = () => {
        if (this.nsSocket) {
            this.nsSocket.close();
            this.nsSocket = null;
        }
    }
}

module.exports = NightscoutClient;