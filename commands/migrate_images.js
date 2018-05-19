const migration = require('../lib/migration.js'),
  request = require('request'),
  fs = require('fs');

let we, conn, models, async, LS;
let count = 0;

module.exports = function Command (program, helpers) {

  program
  .command('migrate-images')
  .alias('MV1I')
  .description('Comando para migrar as imagens')
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

        we.utils.async.series([
          // preload things ...
        ], (err)=> {
          if (err) return doneAll(err);
          importAll(doneAll);
        });
      });

    });
  });
};

function importAll(cb) {
  getImages( (err, records)=> {
    console.log('->  Total to import: ', records.length);
    if (err) return cb(err);

    async.eachSeries(records, (record, next)=> {
      setTimeout( ()=> {
        count++;
        console.log('->  count>', count);
        we.log.info('->  midiaID: ', record.midiaID);

        checkIfIsImported(record.arquivo, (err, imported)=> {

          if (imported) {
            we.log.info('--> Already imported:', record.arquivo);
            next();
          } else {
            importOneImage(record, next);
          }
        });
      }, 300);
    }, cb);
  });
}

function checkIfIsImported (name, cb) {
  models.image.findOne({
    where: { name: buildName(name) },
    attributes: ['id'],
    raw: true
  })
  .then( (r)=> {
    cb(null, Boolean(r));
    return null;
  })
  .catch(cb);
}

function importOneImage(data, cb) {
  if (!data.arquivo) {
    we.log.info('-x> arquivo is required', data);
    return cb();
  }

  const d = {
    name: data.arquivo,
    label: we.utils.string(data.legenda||'').truncate(40).s,
    description: we.utils.string(data.legenda||'').truncate(300).s,
    storageName: 'localImages',
    isLocalStorage: true,
    createdAt: parseD(data.createdat)
  };

  downloadAndSaveImage(d, data, cb);
}

function parseD(d) {
  if (!d) return null;
  return we.utils.moment(d, 'YYYY-MM-DD HH:mm:ss' ).format();
}

function getImages(cb) {
  let sql = 'SELECT * FROM app_historias_midias '+
    'WHERE deletedat IS NULL '+
    'AND formato = "imagem" '+
    'ORDER BY midiaID DESC';
  conn.query(sql, (err, results)=> {
    if (err) return cb(null, err);
    cb(null, results);
  });
}

function buildName(fileName) {
  return 'old_h_'+fileName;
}

function downloadAndSaveImage(d, data, cb) {
  let fileName = d.name;

  if (!fileName) return cb();

  let url = 'https://www.saudeemeulugar.com/static/historias/images/grande_'+fileName;

  we.log.info('--> URL to download: '+url);

  fileName = buildName(fileName);

  let dest = LS.getPath('original', fileName);

  we.log.info('--> Will save in: '+dest);

  let file = fs.createWriteStream(dest);

  const stream = request({ url: url }, (err, response)=> {
    if (err) {
      we.log.error('-x> Error on download file:', err);
      return cb(err);
    }

    if (response.statusCode != 200) {
      we.log.warn('-x> Not 200 response on download file:', response.statusCode, fileName);
      return cb();
    }

    saveImage(d, fileName, cb);
  })
  .pipe(file);

  stream.on('finish', ()=> {
    file.end();
  });
}

function saveImage(file, fileName, cb) {
  file.name = fileName;
  file.path = LS.getPath('original', fileName);

  file.urls = {};
  // set the original url for file upploads
  file.urls.original = LS.getUrlFromFile('original', file);
  // set temporary image styles
  let styles = we.config.upload.image.styles;
  for (let sName in styles) {
    file.urls[sName] = we.config.hostname+'/api/v1/image/' + sName + '/' + file.name;
  }

  LS.generateImageStyles(file, (err)=> {
    if (err) return cb(err);

    models.image.findOrCreate({
      where: { name: file.name },
      defaults: file
    })
    .spread( (record, created)=> {
      if (created) {
        we.log.debug('--> New image record created:', record.id);
      } else {
        we.log.debug('--> Image record exists:', record.id);
      }

      cb(null, record);
      return null;
    })
    .catch(cb);
  });
}


function doneAll(err) {
  if (err) {
    console.error('<-> MV1I:Done with error', err);
  } else {
    console.log('<-> MV1I:Done all');
  }

  we.exit(process.exit);
}