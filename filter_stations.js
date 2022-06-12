var LATEST_YEAR = 2021; // year in Common Era
var MIN_DURATION = 3;   // years

var fs = require('fs');
var inv = JSON.parse(fs.readFileSync('ghcnd-inventory.json', 'utf8'));
var stations = JSON.parse(fs.readFileSync('ghcnd-stations.json', 'utf8'));

function groupBy(v, groupFn) {
  const ret = new Map();
  for (const x of v) {
    const y = groupFn(x);
    if (ret.has(y)) {
      ret.get(y).push(x);
    } else {
      ret.set(y, [x]);
    }
  }
  return ret;
}
var idToInventories = groupBy(inv, x => x.name);
// var idToStation = new Map();
// for (const s of stations) { idToStation.set(s.name, s); }

var goodStations = stations.filter(station => {
  const invs = idToInventories.get(station.name);
  if (invs) {
    const temp = invs.filter(inv => inv.meas === 'TMAX' || inv.meas === 'TMIN');
    if (temp.length === 2) {
      const first = Math.max(...temp.map(o => o.first));
      const last = Math.min(...temp.map(o => o.last));
      if (last >= LATEST_YEAR && (last - first) >= MIN_DURATION) { return true; }
    }
  }
  return false;
})

console.log({inv: idToInventories.size, stations: stations.length, goodStations: goodStations.length});
fs.writeFileSync('good-stations.json', JSON.stringify(goodStations));
var urls = goodStations.map(
    o => `https://www.ncei.noaa.gov/data/global-historical-climatology-network-daily/access/${o.name}.csv`);
fs.writeFileSync('good-stations-urls.txt', urls.join('\n'))