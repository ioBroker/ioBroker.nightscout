const echarts = require('echarts');
const Canvas = require('canvas');
const { JSDOM } = require('jsdom');
const sharp = require('sharp');

const WIDTH = 512;
const HEIGHT = 340;
const words = {
    'Blood glucose': {
        'en': 'Blood glucose',
        'de': 'Blutzucker',
        'ru': 'Глюкоза крови',
        'pt': 'Glicose no sangue',
        'nl': 'Bloed glucose',
        'fr': 'Glucose sanguin',
        'it': 'Glucosio nel sangue',
        'es': 'Glucosa en sangre',
        'pl': 'Glukoza we krwi',
        'uk': 'Рівень глюкози в крові',
        'zh-cn': '血糖值',
    }
};

function generateSvg(eOptions, width, height) {
    const {window} = new JSDOM();
    echarts.setCanvasCreator(() => Canvas.createCanvas(width, height));

    global.window = window;
    global.navigator = window.navigator;
    global.document = window.document;

    const root = document.createElement('div');
    root.style.cssText = `width: ${width}px; height: ${height}px;`;

    const chart = echarts.init(root, null, {renderer: 'svg'});
    chart.setOption(eOptions);

    const svg = root.querySelector('svg').outerHTML;
    chart.dispose();
    return svg;
}

function svg2image(svg, format) {
    if (format === 'svg') {
        Promise.resolve(`data:image/svg+xml;base64,${svg.toString('base64')}`);
    } else if (format === 'jpg') {
        return sharp(Buffer.from(svg))
            .jpeg()
            .toBuffer()
            .then(data => `data:image/jpeg;base64,${data.toString('base64')}`);
    } else {
        return sharp(Buffer.from(svg))
            .png()
            .toBuffer()
            .then(data => `data:image/png;base64,${data.toString('base64')}`);
    }
}

function getImage(timeSeries, opts) {
    // convert data
    let svg;
    if (typeof timeSeries === 'object') {
        /*
        [
    {
        "_id": "5e8866449c68e49bc62f42c2",
        "device": "xDrip-LibreReceiver",
        "date": 1585997381165,
        "dateString": "2020-04-04T10:49:41.165Z",
        "sgv": 80,
        "delta": -4.006,
        "direction": "Flat",
        "type": "sgv",
        "filtered": 77000,
        "unfiltered": 77000,
        "rssi": 100,
        "noise": 1,
        "sysTime": "2020-04-04T10:49:41.165Z",
        "utcOffset": 120
    },
    {
        "_id": "5e8865199c68e49bc62f4233",
        "device": "xDrip-LibreReceiver",
        "date": 1585997081634,
        "dateString": "2020-04-04T10:44:41.634Z",
        "sgv": 84,
        "delta": -3.001,
        "direction": "Flat",
        "type": "sgv",
        "filtered": 78000,
        "unfiltered": 78000,
        "rssi": 100,
        "noise": 1,
        "sysTime": "2020-04-04T10:44:41.634Z",
        "utcOffset": 120
    },
         */

        const data  = timeSeries.filter(v => v && v.sgv !== null && v.sgv !== undefined).map(v =>({value: [v.date, v.sgv]}));
        opts.min    = opts.min || 80;
        opts.max    = opts.max || 180;
        opts.width  = opts.width || WIDTH;
        opts.height = opts.height || HEIGHT;
        opts.lang   = opts.lang || 'de';

        const options = {
            title: {
                text:  opts.title || words['Blood glucose'][opts.lang]
            },
            grid: {
                backgroundColor: 'white',
                show: true
            },
            xAxis: {
                type: 'time',
                splitLine: {
                    show: true
                },
                axisLabel: {
                    formatter: value => {
                        value = new Date(value);
                        return `${value.getHours()}:${value.getMinutes().toString().padStart(2, '0')}`;
                    }
                }
            },
            yAxis: {
                type: 'value',
                splitLine: {
                    show: true
                },
                min: 40,
            },
            series: [{
                name: 'mg/dl',
                type: 'line',
                showSymbol: true,
                animation: false,
                hoverAnimation: false,
                data,
                smooth: true,
                markArea: {
                    itemStyle: {
                        normal: {
                            color: '#00800020',
                        },
                        emphasis: {
                            color: '#00800020',
                        },
                    },
                    data: [
                        [
                            {
                                yAxis: opts.min,
                            },
                            {
                                yAxis: opts.max,
                            },
                        ],
                    ],
                }
            }]
        };
        svg = generateSvg(options, opts.width, opts.height);
    } else {
        svg = `<svg width="${WIDTH}" height="${HEIGHT}" xmlns="http://www.w3.org/2000/svg"><g>
  <text font-size="36px" y="206.85" x="50" stroke-width="0" stroke="#000" fill="#000000">${timeSeries}</text>
</g></svg>`;
    }

    return svg2image(svg, opts.format);
}

module.exports = getImage;
