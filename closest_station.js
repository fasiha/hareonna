var dsvPromise = import('d3-dsv');
var ProgressBar = require('progress');
var dayjs = require('dayjs');
var fs = require('fs');
var stations = JSON.parse(fs.readFileSync('good-stations.json', 'utf8'));

var YEARS_AGO = 3;

function distsq(a, b) { return (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2; }
function closest(origin, limit = 50, stationsList = undefined) {
  stationsList = stationsList || stations;
  const distsIdxs = stationsList.map((o, i) => [distsq([o.lat, o.lon], origin), i]);
  distsIdxs.sort((a, b) => a[0] - b[0]);
  return distsIdxs.slice(0, limit).map(([_, idx]) => stationsList[idx]);
}

function quantile(qs, data) {
  const sorted = data.filter(x => x !== undefined).sort((a, b) => a - b);
  const idxs = qs.map(q => Math.round(q * (sorted.length - 1))); // this maps 0 => 0 and 1.0 => length-1
  return idxs.map(i => sorted[i]);
}

async function parse(input) {
  var dsv = await dsvPromise;
  var rows = dsv.csvParse(input);
  return rows;
}

function getRowsFromFile(station, parentPath = '.') {
  var name = station.name;
  var fname = `${parentPath}/${name}.csv`;
  return parse(fs.readFileSync(fname, 'utf8'));
}

function stationToPercentile(rows) {
  var oldestDate = dayjs().subtract(YEARS_AGO, 'year');
  var oldest = oldestDate.format('YYYY-MM-DD');

  var newEnough = rows.filter(o => o.DATE > oldest);
  var tmin = newEnough.map(o => o.TMIN ? +o.TMIN : undefined);
  var tmax = newEnough.map(o => o.TMAX ? +o.TMAX : undefined);

  var daysElapsed = dayjs().diff(oldestDate, 'days');
  var goods = [tmin, tmax].map(v => v.filter(x => x !== undefined).length);
  var goodPcts = goods.map(x => x / daysElapsed);

  var ps = [0, 0.025, 0.05, 0.1, 0.5, 0.9, 0.95, 0.975, 1];
  var lows = quantile(ps, tmin).map(o => o / 10);
  var his = quantile(ps, tmax).map(o => o / 10);

  return {ps, lows, his, goods, goodPcts, totalCount: newEnough.length};
}

async function describeSummary(station, obj) {
  var dsv = await dsvPromise;

  var summary =
      obj.ps.map((p, i) => ({name: station.name, percentile: `${p * 100}%`, low: obj.lows[i], high: obj.his[i]}));
  var csv = dsv.csvFormat(summary);

  var summaryKeys = Object.keys(summary[0]).filter(x => x !== 'name');
  var md = `| ${summaryKeys.join(' | ')} |
| ${summaryKeys.map(_ => '---').join(' | ')} |
${summary.map(o => '| ' + summaryKeys.map(k => o[k]).join(' | ') + ' |').join('\n')}`;
  return {md, csv};
}

if (require.main === module) {
  // South San Francisco BART station
  // const origin = [37.6642278, -122.4439774];
  const origin = [37.56396, -122.32289]; // Noodleosophy
  console.log(closest(origin, 5));
  {
    const origin = [37.56396, -122.32289]; // Noodleosophy
    var allStations = JSON.parse(fs.readFileSync('ghcnd-stations.json', 'utf8'));
    console.log('All stations:')
    console.log(closest(origin, 5, allStations));
  }

  var {env} = require('process');
  var parentPath = `${env.HOME}/Downloads/ghcnd-csvs`;

  (async function main() {
    var names = 'USC00048829 USW00023234 USC00043714'.split(' ');
    var handful = names.map(s => stations.find(o => o.name === s));
    for (const s of handful) {
      const rows = await getRowsFromFile(s, parentPath);
      const processed = stationToPercentile(rows);
      const readable = await describeSummary(s, processed);
      console.log(`## ${s.desc} (${
          processed.goodPcts.map(x => `${Math.round(x * 1000) / 10}%`).join('/')} data in last ${YEARS_AGO} years)
${readable.md}

`);
    }

    var bar =
        new ProgressBar('  Processing [:bar] :rate fps :percent :etas',
                        {complete: '=', incomplete: ' ', width: 20, total: stations.length, renderThrottle: 2000});

    let stationsToSummarize = stations;
    if (fs.existsSync('good-stations-summary.json')) {
      stationsToSummarize = JSON.parse(fs.readFileSync('good-stations-summary.json', 'utf8'));
    }
    for (const s of stationsToSummarize) {
      if (!('summary' in s)) { s.summary = stationToPercentile(await getRowsFromFile(s, parentPath)); }
      bar.tick();
    }
    fs.writeFileSync('good-stations-summary.json', JSON.stringify(stationsToSummarize, null, 1));
    console.log(`\n${stations.length} stations processed`)
  })()
}