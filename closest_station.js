var fs = require('fs');
var stations = JSON.parse(fs.readFileSync('good-stations.json', 'utf8'));

function distsq(a, b) { return (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2; }
function closest(origin, limit = 50) {
  const distsIdxs = stations.map((o, i) => [distsq([o.lat, o.lon], origin), i]);
  distsIdxs.sort((a, b) => a[0] - b[0]);
  return distsIdxs.slice(0, limit).map(([_, idx]) => stations[idx]);
}

if (require.main === module) {
  const origin = [37.6642278, -122.4439774];
  console.log(closest(origin, 5));
}