var dsvPromise = import('d3-dsv');
var ProgressBar = require('progress');
var fs = require('fs');
var stations = JSON.parse(fs.readFileSync('good-stations.json', 'utf8'));

function distsq(a, b) { return (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2; }
function closest(origin, limit = 50) {
  const distsIdxs = stations.map((o, i) => [distsq([o.lat, o.lon], origin), i]);
  distsIdxs.sort((a, b) => a[0] - b[0]);
  return distsIdxs.slice(0, limit).map(([_, idx]) => stations[idx]);
}

function quantile(qs, data) {
  const sorted = data.filter(x => x !== undefined).sort((a, b) => a - b);
  const idxs = qs.map(q => Math.round(q * (sorted.length - 1))); // this maps 0 => 0 and 1.0 => length-1
  return idxs.map(i => sorted[i]);
}

async function stationToPercentile(station, parentPath = '.') {
  var dsv = await dsvPromise;
  var name = station.name;
  var fname = `${parentPath}/${name}.csv`;
  var rows = dsv.csvParse(fs.readFileSync(fname, 'utf8'));

  var YEARS_AGO = 10;
  var today = new Date();
  var oldest = `${today.getUTCFullYear() - YEARS_AGO}-01-01`;

  var newEnough = rows.filter(o => o.DATE > oldest);
  var tmin = newEnough.map(o => o.TMIN ? +o.TMIN : undefined);
  var tmax = newEnough.map(o => o.TMAX ? +o.TMAX : undefined);

  var bads = [tmin, tmax].map(v => v.filter(x => x === undefined).length);
  var badPcts = bads.map(x => x / newEnough.length);

  var ps = [0, 0.025, 0.05, 0.1, 0.5, 0.9, 0.95, 0.975, 1];
  var lows = quantile(ps, tmin).map(o => o / 10);
  var his = quantile(ps, tmax).map(o => o / 10);

  var summary = ps.map((p, i) => ({name, percentile: `${p * 100}%`, low: lows[i], high: his[i]}));
  var csv = dsv.csvFormat(summary);

  var summaryKeys = Object.keys(summary[0]).filter(x => x !== 'name');
  var md = `| ${summaryKeys.join(' | ')} |
| ${summaryKeys.map(_ => '---').join(' | ')} |
${summary.map(o => '| ' + summaryKeys.map(k => o[k]).join(' | ') + ' |').join('\n')}`;
  return {ps, lows, his, csv, md, bads, badPcts, totalCount: newEnough.length};
}

if (require.main === module) {
  // South San Francisco BART station
  const origin = [37.6642278, -122.4439774];
  console.log(closest(origin, 5));

  var {env} = require('process');
  var parentPath = `${env.HOME}/Downloads/ghcnd-csvs`;

  (async function main() {
    var names = 'USC00048829 USW00023234 USC00043714'.split(' ');
    var handful = names.map(s => stations.find(o => o.name === s));
    for (const s of handful) {
      const processed = await stationToPercentile(s, parentPath);
      console.log(`## ${s.desc}
${processed.md}

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
      if (!('summary' in s)) { s.summary = await stationToPercentile(s, parentPath); }
      bar.tick();
    }
    fs.writeFileSync('good-stations-summary.json', JSON.stringify(stationsToSummarize));
  })()
}