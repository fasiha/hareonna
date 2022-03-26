var fs = require('fs');
var lines = fs.readFileSync('ghcnd-stations.txt', 'utf8').trim().split('\n');
var stations =
    lines
        .map(line => {
          const match =
              line.match(/^(?<name>\S+)\s+(?<lat>[0-9-.]+)\s+(?<lon>[0-9-.]+)\s+(?<elev>[0-9-.]+)\s+(?<desc>.*)$/);
          if (match) {
            const {name, lat, lon, elev, desc} = match.groups;
            if (!name || !lat || !lon || !elev || !desc) { console.log(match.groups) }
            const ret = {name, lat: parseFloat(lat), lon: parseFloat(lon), elev: parseFloat(elev), desc: desc.trim()};
            if (!isNaN(ret.lat) && !isNaN(ret.lon) && !isNaN(ret.elev) && ret.name) { return ret; }
          }
          return undefined;
        })
        .filter(x => !!x);
fs.writeFileSync('ghcnd-stations.json', JSON.stringify(stations));

var invlines = fs.readFileSync('ghcnd-inventory.txt', 'utf8').trim().split('\n');
var inv =
    invlines
        .map(line => {
          const match = line.match(
              /^(?<name>\S+)\s+(?<lat>[0-9-.]+)\s+(?<lon>[0-9-.]+)\s+(?<meas>\S+)\s+(?<first>[0-9]+)\s+(?<last>[0-9]+)$/);
          if (match) {
            const {name, meas, first, last} = match.groups;
            const extra = {name, meas, first: parseInt(first), last: parseInt(last)};
            return extra;
          }
        })
        .filter(x => !!x);
fs.writeFileSync('ghcnd-inventory.json', JSON.stringify(inv));
