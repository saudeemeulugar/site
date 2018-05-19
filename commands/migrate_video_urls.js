const migration = require('../lib/migration.js');

let we, conn, models, async;
let count = 0;

module.exports = function Command (program, helpers) {

  program
  .command('migrate-video-urls')
  .alias('MV1VVU')
  .description('Comando para migrar as urls dos vídeos')
  .action( function run() {
    we = helpers.getWe();

    we.bootstrap( (err)=> {
      if (err) return doneAll(err);

      models = we.db.models;
      async = we.utils.async;

      migration.getConnection(we, (err, c)=> {
        if (err) return doneAll(err);
        conn = c;

        importAll(doneAll);
      });

    });
  });
};

function importAll(cb) {
  getAllVideoUrls((err, data)=> {
    if (err) return cb(err);

    we.log.info('<-> Total to import:', data.length);

    we.utils.async.eachSeries(data, (item, next)=> {
      importOne(item, next);
    }, cb);
  });
}

function importOne(item, cb) {
  count ++;
  we.log.info('-> will import: '+item.link+ ' count:'+count);
  we.db.models['file-url'].findOrCreate({
    where: { url: item.link },
    defaults: {
      label: we.utils.string(
        item.legenda ||
        item.title ||
        ''
      ).truncate(30).s,
      description: item.legenda || item.title,
      url:  item.link,
      createdAt: parseD(item.createdat),
      updatedAt: parseD(item.updatedat)
    }
  })
  .spread( (r, created)=> {
    if (created) {
      we.log.info('--> URL added:', r.text);
    } else {
      we.log.info('--> URL exits', r.text);
    }
    cb();
    return null;
  })
  .catch(cb);
}

function getAllVideoUrls(cb) {
  let sql = 'SELECT AHM.* '+
    'FROM app_historias_midias AHM '+
    'WHERE formato = "video" '+
    'AND deletedat IS NULL '+
    'AND link IS NOT NULL ';
  conn.query(sql, (err, r1)=> {
    if (err) return cb(err);

    let sql = 'SELECT AH.* '+
      'FROM app_historias AH '+
      'WHERE tipo = "video" '+
      'AND deletedat IS NULL '+
      'AND link IS NOT NULL ';
    conn.query(sql, (err, r2)=> {
      if (err) return cb(err);
      cb(null, r1.concat(r2));
    });
  });
}

function parseD(d) {
  if (!d) return null;
  return we.utils.moment(d, 'YYYY-MM-DD HH:mm:ss' ).format();
}

function doneAll(err) {
  if (err) {
    console.error('MV1T:Done with error', err);
  } else {
    console.log('MV1T:Done all, total imported:'+count);
  }

  we.exit(process.exit);
}