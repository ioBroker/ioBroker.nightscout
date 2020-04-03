const echarts = require("echarts");
const Canvas = require('canvas');
const {JSDOM} = require('jsdom');
const sharp = require('sharp');

echarts.setCanvasCreator(() => Canvas.createCanvas(720, 480));

function generateSvg(options) {
    const {window} = new JSDOM();

    global.window = window;
    global.navigator = window.navigator;
    global.document = window.document;

    const root = document.createElement('div');
    root.style.cssText = 'width: 720px; height: 480px;';

    const chart = echarts.init(root, null, {renderer: 'svg'});
    chart.setOption(options);

    const svg = root.querySelector('svg').outerHTML;
    chart.dispose();
    return svg;
}

function svg2image(svg, format) {
    if (format === 'svg') {
        Promise.resolve(svg);
    } else if (format === 'jpg') {
        return sharp(Buffer.from(svg))
            .jpeg()
            .toBuffer()
            .then(data => data.toString('base64'));
    } else {
        return sharp(Buffer.from(svg))
            .png()
            .toBuffer()
            .then(data => data.toString('base64'));
    }
}
/*
const lines = `124;true;nightscout.0;2020-04-03T14:04:17.150Z;;
135;true;nightscout.0;2020-04-03T13:59:17.230Z;;
143;true;nightscout.0;2020-04-03T13:54:16.925Z;;
151;true;nightscout.0;2020-04-03T13:49:17.020Z;;
162;true;nightscout.0;2020-04-03T13:44:16.749Z;;
177;true;nightscout.0;2020-04-03T13:34:16.793Z;;
190;true;nightscout.0;2020-04-03T13:29:15.315Z;;
201;true;nightscout.0;2020-04-03T13:24:15.400Z;;
212;true;nightscout.0;2020-04-03T13:19:14.706Z;;
224;true;nightscout.0;2020-04-03T13:14:14.017Z;;
235;true;nightscout.0;2020-04-03T13:09:15.661Z;;
243;true;nightscout.0;2020-04-03T13:04:13.404Z;;
118;true;nightscout.0;2020-04-03T11:33:08.230Z;;
105;true;nightscout.0;2020-04-03T11:28:08.709Z;;
92;true;nightscout.0;2020-04-03T11:23:07.087Z;;
80;true;nightscout.0;2020-04-03T11:17:06.758Z;;
76;true;nightscout.0;2020-04-03T11:11:05.363Z;;
75;true;nightscout.0;2020-04-03T11:06:06.620Z;;
77;true;nightscout.0;2020-04-03T11:01:05.924Z;;
84;true;nightscout.0;2020-04-03T10:56:05.231Z;;
92;true;nightscout.0;2020-04-03T10:51:04.142Z;;
101;true;nightscout.0;2020-04-03T10:46:05.007Z;;
112;true;nightscout.0;2020-04-03T10:41:04.289Z;;
122;true;nightscout.0;2020-04-03T10:36:04.394Z;;
135;true;nightscout.0;2020-04-03T10:31:03.698Z;;
150;true;nightscout.0;2020-04-03T10:26:04.176Z;;
166;true;nightscout.0;2020-04-03T10:21:03.152Z;;
180;true;nightscout.0;2020-04-03T10:16:04.792Z;;
188;true;nightscout.0;2020-04-03T10:11:03.706Z;;
183;true;nightscout.0;2020-04-03T10:06:03.789Z;;
169;true;nightscout.0;2020-04-03T10:01:03.581Z;;
162;undefined;;2020-04-03T09:53:02.684Z;;
`.split('\n').filter(l => l);

const data = lines.map(line => {
    const parts = line.split(';');
    const now = new Date(parts[3]);
    return {name: now.toString(), value: [now.getTime(), parts[0]]};
});
data.forEach(d => {
    if (parseFloat(d.value[1]) > 180) {
        d.itemStyle = {color: '#FF0000'};
    } else if (parseFloat(d.value[1]) < 75) {
        d.itemStyle = {color: '#FF0000'};
    } else {
        d.itemStyle = {color: '#00FF00'};
    }
});
const options = {
    title: {
        text:  'Blutzucker in letzten 3 Stunden'
    },
    xAxis: {
        type: 'time',
        splitLine: {
            show: true
        },
        axisLabel: {
            formatter: value => {
                value = new Date(value);
                return value.getHours() + ':' + value.getMinutes().toString().padStart(2, '0');
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
                    color: '#00800020'
                },
                emphasis: {
                    color: '#00800020'
                }
            },
            data: [
                [
                    {
                        name: data[0].value[0],
                        yAxis: 80,
                    },
                    // end point of the line
                    {
                        yAxis: 180,
                        symbol: 'none'
                    }
                ]
            ],
        }
    }]
};

console.log(JSON.stringify(data));
*/

//svg2png(generateSvg(options));

function getImage(timeSeries, min, max, format) {
    // convert data
    let svg;
    if (typeof timeSeries === 'object') {
        const data = timeSeries.map(v =>({value: [v.ts, v.val]}));
        min = min || 80;
        max = max || 180;
        const options = {
            title: {
                text:  'Blutzucker in letzten 3 Stunden'
            },
            xAxis: {
                type: 'time',
                splitLine: {
                    show: true
                },
                axisLabel: {
                    formatter: value => {
                        value = new Date(value);
                        return value.getHours() + ':' + value.getMinutes().toString().padStart(2, '0');
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
                            color: '#00800020'
                        },
                        emphasis: {
                            color: '#00800020'
                        }
                    },
                    data: [
                        [
                            {
                                name: data[0].value[0],
                                yAxis: min,
                            },
                            {
                                yAxis: max,
                            }
                        ]
                    ],
                }
            }]
        };
        svg = generateSvg(options);
    } else {
        svg = `<svg width="720" height="480" xmlns="http://www.w3.org/2000/svg"><g>
  <text font-size="36px" y="206.85" x="50" stroke-width="0" stroke="#000" fill="#000000">${timeSeries}</text>
</g></svg>`;
    }

    return svg2image(svg, format);
}

module.exports = getImage;
