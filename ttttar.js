var tar = require('tar');

function extractFileFromTarball(tarpath, filename) {
  var nentries = 0;
  var data = [];
  var onentry = entry => {
    nentries++;
    if (nentries % 1e4 === 0) { console.log(`nentries=${nentries}, data.length=${data.length}`); }
    if (entry.path === filename) { entry.on('data', c => data.push(c)); }
  };
  tar.t({onentry, file: tarpath, sync: true});
  var buf = Buffer.concat(data);
  return buf.toString('ascii');
}

function extractBuffersFromTarball(tarpath, filenames, verbose = true) {
  if (Array.isArray(filenames)) { filenames = new Set(filenames); }

  var data = {};
  var onentry;
  var n = 0;
  if (verbose) {
    onentry = entry => {
      n++;
      if (n % 10e3 === 0) { console.log(`iter ${n}, ${Object.keys(data).length} files found`) }
      if (filenames.has(entry.path)) {
        entry.on('data', c => { data[entry.path] = (data[entry.path] || []).concat(c); });
        entry.on('end', () => { data[entry.path] = buffersToString(data[entry.path]); })
      }
    };
  } else {
    onentry = entry => {
      if (filenames.has(entry.path)) { entry.on('data', c => data[entry.path] = (data[entry.path] || []).concat(c)); }
    };
  }
  tar.t({onentry, file: tarpath, sync: true});
  if (verbose) { console.log(`iter ${n}, ${Object.keys(data).length} files found`); }
  return data;
}

function buffersToString(data) { return Buffer.concat(data).toString('ascii'); }

module.exports = {
  buffersToString,
  extractFileFromTarball,
  extractBuffersFromTarball
};

if (require.main === module) {
  console.log(extractFileFromTarball('csvs.tar.gz', 'USC00048829.csv').slice(0, 100));
  var res = extractBuffersFromTarball('csvs.tar.gz',
                                      new Set('USC00048829 USW00023234 USC00043714'.split(' ').map(s => s + '.csv')));
  for (const key of Object.keys(res)) { console.log(res[key].slice(0, 200)); }

  var {env} = require('process');
  var res = extractFileFromTarball(env.HOME + '/Downloads/daily-summaries-latest.tar.gz', 'USC00048829.csv');
  console.log(res.slice(0, 100))
  var res = extractFileFromTarball(env.HOME + '/Downloads/daily-summaries-latest.tar.gz', 'USW00023234.csv');
  console.log(res.slice(0, 100))

  var fs = require('fs');
  var stations = JSON.parse(fs.readFileSync('good-stations.json', 'utf8'));
  var res = extractBuffersFromTarball(env.HOME + '/Downloads/daily-summaries-latest.tar.gz',
                                      new Set(stations.map(s => s.name + '.csv')));
  // fs.writeFileSync('res.json', JSON.stringify(res));
  // console.log('res.json written')
  console.log(`${Object.keys(res).length} keys found!`)
}