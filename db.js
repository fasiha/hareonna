var sqlite3 = require('better-sqlite3');
var {readFileSync} = require('fs');

function dbVersionCheck(db, requiredVersion) {
  const s = db.prepare(`select schemaVersion from _db_state`);
  const dbState = s.get();
  if (dbState?.schemaVersion !== requiredVersion) { throw new Error('db wrong version: need ' + requiredVersion); }
}
function dbInit(requiredVersion) {
  const fname = __dirname + `/db-v${requiredVersion}.db`;
  const db = sqlite3(fname);
  db.pragma('journal_mode = WAL'); // https://github.com/JoshuaWise/better-sqlite3/blob/master/docs/performance.md
  let s = db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name=?`);
  const tableThere = s.get('_db_state');

  if (tableThere) {
    // ensure it's the correct version, else bail; implement up/down migration later
    dbVersionCheck(db, requiredVersion);
  } else {
    console.log('uninitialized, will create schema');
    db.exec(readFileSync(`db-v${requiredVersion}.sql`, 'utf8'));
    dbVersionCheck(db, requiredVersion);
  }
  return db;
}
module.exports = {dbInit};