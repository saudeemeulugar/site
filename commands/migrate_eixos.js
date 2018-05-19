const migration = require('../lib/migration.js');

let we, conn, models, async, LS;
let count = 0;

module.exports = function Command (program, helpers) {

  program
  .command('migrate-terms')
  .alias('MV1T')
  .description('Comando para migrar os eixos para categorias')
  .action( function run() {
    we = helpers.getWe();

    we.bootstrap( (err)=> {
      if (err) return doneAll(err);

      models = we.db.models;
      async = we.utils.async;
      LS = we.config.upload.storages.localImages;

      migration.getConnection(we, (err, c)=> {
        if (err) return doneAll(err);
        conn = c;

        importAll(doneAll);
      });

    });
  });
};

function importAll(cb) {
  getAllExitoTerms((err, terms)=> {
    if (err) return cb(err);

    we.log.info('<-> Total to import:', terms.length);

    we.utils.async.eachSeries(terms, (term, next)=> {
      importOne(term, next);
    }, cb);
  });
}

function importOne(term, cb) {
  count ++;
  we.log.info('-> will import: '+term.termo+ ' count:'+count);
  we.db.models.term.findOrCreate({
    where: { text: term.termo },
    defaults: {
      text: term.termo,
      // description: '',
      vocabularyName: 'Category',
      createdAt: parseD(term.createdat),
      updatedAt: parseD(term.updatedat)
    }
  })
  .spread( (r, created)=> {
    if (created) {
      we.log.info('--> Term added:', r.text);
    } else {
      we.log.info('--> Term exits', r.text);
    }
    cb();
    return null;
  })
  .catch(cb);
}

function getAllExitoTerms(cb) {
  let sql = 'SELECT DISTINCT AT.* '+
    'FROM app_taxonomy AT '+
    'WHERE AT.deletedat IS NULL '+
    'AND AT.taxonomy = "Eixo" ';
  conn.query(sql, (err, results)=> {
    if (err) return cb(null, err);
    cb(null, results);
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
