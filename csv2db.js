var YEARS_AGO = 10;

var {dbInit} = require('./db');
var dsvPromise = import('d3-dsv');
var fs = require('fs');
var ProgressBar = require('progress');

var stations = JSON.parse(fs.readFileSync('good-stations.json', 'utf8'));

var db = dbInit(1);
var insertStation = db.prepare(`insert or ignore into station 
(name, lat, lon, elev, desc)
values
($name, $lat, $lon, $elev, $desc)`);

var insertRow = db.prepare(`insert or ignore into daily
(name, yyyymmdd, tmax, tmin)
values
($name, $yyyymmdd, $tmax, $tmin)`);

async function process(path = '.') {
  var dsv = await dsvPromise;

  var today = new Date();
  var oldest = `${today.getUTCFullYear() - YEARS_AGO}-01-01`;

  var bar = new ProgressBar(':bar', {total: stations.length});
  for (const station of stations) {
    bar.tick();

    insertStation.run(station);
    var name = station.name;
    var fname = path + '/' + name + '.csv';
    var rows = dsv.csvParse(fs.readFileSync(fname, 'utf8'));
    for (const row of rows) {
      if (oldest > row.DATE) { continue; }
      const tmin = row.TMIN ? +row.TMIN / 10 : null;
      const tmax = row.TMAX ? +row.TMAX / 10 : null;
      if (tmin === null && tmax === null) { continue; }
      const yyyymmdd = row.DATE;
      const toinsert = {yyyymmdd, tmax, tmin, name};
      insertRow.run(toinsert)
    }
  }
}

if (require.main === module) {
  var {env} = require('process');
  process(`${env.HOME}/Downloads/ghcnd-csvs`);
}