var {env} = require('process');
var tar = require('tar');
var dsvPromise = import('d3-dsv');
var ProgressBar = require('progress');
var dayjs = require('dayjs');
var fs = require('fs');

var goodStations = JSON.parse(fs.readFileSync('good-stations.json', 'utf8'));

var YEARS_AGO = 3;

function distsq(a, b) { return (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2; }
function closest(origin, limit = 50, stationsList = undefined) {
  stationsList = stationsList || goodStations;
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

function stationToPercentile(rows, yearsAgo = YEARS_AGO) {
  var oldestDate = dayjs().subtract(yearsAgo, 'year');
  var oldest = oldestDate.format('YYYY-MM-DD');

  var newEnough = rows.filter(o => o.DATE > oldest);
  var tmin = newEnough.map(o => o.TMIN ? +o.TMIN : undefined);
  var tmax = newEnough.map(o => o.TMAX ? +o.TMAX : undefined);

  var goods = [tmin, tmax].map(v => v.filter(x => x !== undefined).length);
  var daysElapsed = dayjs().diff(oldestDate, 'days');

  var ps = [0, 0.025, 0.05, 0.1, .25, 0.5, .75, 0.9, 0.95, 0.975, 1];
  var lows = quantile(ps, tmin).map(o => o / 10);
  var his = quantile(ps, tmax).map(o => o / 10);

  return {ps, lows, his, goods, days: daysElapsed};
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

  const csvToIndex = new Map(goodStations.flatMap((s, i) => s.summary ? [] : [[s.name + '.csv', i]]));
  var bar = new ProgressBar('  Processing [:bar] :rate fps :percent :etas',
                            {complete: '=', incomplete: ' ', width: 20, total: csvToIndex.size, renderThrottle: 2000});
  console.log(`to process: ${csvToIndex.size} stations`);

  (async function main() {
    var dsv = await dsvPromise;
    function parse(input) {
      var rows = dsv.csvParse(input);
      return rows;
    }
    if (csvToIndex.size > 0) {
      tar.t({
        sync: true,
        file: env.HOME + '/Downloads/daily-summaries-latest.tar.gz',
        onentry: e => {
          if (csvToIndex.has(e.path)) {
            let data = [];
            e.on('data', c => data.push(c))
            e.on('end', () => {
              const raw = Buffer.concat(data).toString('ascii');
              const parsed = parse(raw);
              const idx = csvToIndex.get(e.path);
              goodStations[idx].summary = stationToPercentile(parsed);
              bar.tick();
            });
          }
        }
      });
      fs.writeFileSync(
          'good-stations-summary.json',
          JSON.stringify({percentiles: goodStations[0].ps, stations: goodStations.map(o => ({...o, ps: undefined}))},
                         null, 1));
    }
  })();
}