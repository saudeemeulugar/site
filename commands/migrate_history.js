const migration = require('../lib/migration.js');

let we, conn, models, async, LS;
let cats = {};
let locations = {};
let count = 0;

module.exports = function Command (program, helpers) {

  program
  .command('migrate-history')
  .alias('MV1H')
  .description('Comando para migrar as histórias')
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
          preloadAllCats,
          preloadAllLocations
        ], (err)=> {
          if (err) return doneAll(err);
          importAll(doneAll);
        });
      });

    });
  });
};

function importAll(cb) {
  getAllV1Histories( (err, records)=> {
    if (err) return cb(err);

    async.eachSeries(records, (record, next)=> {
      setTimeout( ()=> {
        we.log.info('-> historiaID: ', record.historiaID);

        count++;
        console.log('-> count>', count);

        we.utils.async.series([
          function(done) {
            getHistoryTexts(record.historiaID, (err, texts)=> {
              if (err) return done(err);
              record.texts = texts;
              done();
            });
          },
          function(done) {
            getCreatorId(record.usuarioID, (err, id)=> {
              if (err) return done(err);
              record.creatorId = id;
              done();
            });
          },
          function (done) {
            getHistoryTerms(record.historiaID, (err, terms)=> {
              if (err) return done(err);

              record.cats = [];
              record.tags = [];

              terms.forEach( (t)=> {
                if (t.taxonomy == 'Eixo') {
                  record.cats.push(t.termo);
                } else if (t.taxonomy == 'Tag') {
                  record.tags.push(t.termo);
                } else {
                  we.log.warn('-x> Unknow term:', t);
                }
              });

              done();
            });
          },
          function (done) {
            getHistoryVideos(record, (err, videos)=> {
              if (err) return done(err);

              if (!videos || !videos.length) {
                return done();
              }

              record.videoUrls = videos;
              done();
            });
          }
        ], (err)=> {
          if (err) return next(err);

          checkIfIsImported(record, (err, isImported)=> {
            if (err) return next(err);
            if (isImported) {
              we.log.info('<-> Already imported: ', record.historiaID);
              return next();
            }

            if (
              record.tipo === 'imagem' ||
              record.tipo === 'texto' ||
              record.tipo === 'video'
            ) {
              // delay on each import:
              return importOneTipoImage(record, next);
            } else {
              console.log('TODO! tipo: '+record.tipo);
              return next();
            }
          });

        });
      }, 300);
    }, cb);
  });
}

function checkIfIsImported(data, cb) {
  models['imported-history'].findOne({
    where: { eid: data.historiaID },
    attributes: ['id'],
    raw: true
  })
  .then( (r)=> {
    cb(null, Boolean(r));
    return null;
  })
  .catch(cb);
}

function importOneTipoImage(data, cb) {
  if (!data.titulo) {
    we.log.info('titulo is required', data.historiaID);
    return cb();
  }

  let dh = buildBasicData(data);

  if (
    data.type == 'video' &&
    (!data.videoUrls || !data.videoUrls.length)
  ) {
    we.log.warn('-x> Video history without url found', data.historiaID);
    return cb();
  }

  let featuredImageId = null;

  models.history.create(dh)
  .then( (history)=> { // save history featured image
    return new Promise( (resolve, reject)=> {
      saveHistoryImage(history, data.arq, (err, image)=> {
        if (err) reject(err);

        if (image) {
          featuredImageId = image.id;
        }

        history.set('featuredImage', [image]);
        history.save().then(()=> {
          resolve(history);
          return null;
        })
        .catch(reject);
      });
    });
  })
  .then( (history)=> { // save history images
    return new Promise( (resolve, reject)=> {
      getHistoryImages(data.historiaID, (err, images)=>{
        if (err) return reject(err);

        const imgs = [];

        we.utils.async.eachSeries(images, (image, next)=> {
          saveHistoryImage(history, image.arquivo, (err, im)=> {
            if (err) next(err);

            if (!im) return next();

            if (!featuredImageId && im) {
              featuredImageId = im.id;
              history.set('featuredImage', [im]);
              return next();
            }

            if (im.id == featuredImageId.id) {
              // already salved in featured image.
              return next();
            }

            imgs.push(im);
            next();
          });
        }, (err)=> {
          if (err) return reject;
          history.set('images', imgs);
          history.save()
          .then(()=> {
            resolve(history);
            return null;
          })
          .catch(reject)

        });
      });
    });
  })
  .then( (history)=> {
    return models['imported-history'].create({
      eid: data.historiaID,
      historyId: history.id,
      status: 'imported'
    })
    .then( ()=> {
      return history;
    });
  })
  .then( (history)=> {
    console.log('http://localhost:9400/history/'+history.id, {
      type: data.tipo
    });
    cb();
    return null;
  })
  .catch(cb);
}

function buildBasicData(data) {
  let locationState, city;

  let loc = locations[data.localID];
  if (loc) {
    locationState = loc.uf;
    city = loc.nome;
  }

  let body = '';

  if (data.texts && data.texts.length) {
    body = data.texts
    .filter((t)=> {
      return Boolean(t);
    })
    .map((t)=> {
      return t.body;
    })
    .join('<br>');
  }

  const dh = {
    title: data.titulo,
    body: body,
    publishAsAnonymous: false,
    published: true,
    haveImage: true,
    haveVideo: Boolean(
      data.videoUrls || data.videoUrls.length
    ),
    country: 'BR',
    locationState: locationState,
    city: city,
    tags: data.tags,
    isImported: true,
    category: data.cats,
    creatorId: data.creatorId,
    videoUrls: data.videoUrls,
    historyDate: parseD(data.createdat),
    createdAt: parseD(data.createdat),
    updatedAt: parseD(data.updatedat)
  };

  if (data.anonimo != 0 || data.anonimo != '0') {
    dh.publishAsAnonymous = true;
  }

  return dh;
}

function parseD(d) {
  if (!d) return null;
  return we.utils.moment(d, 'YYYY-MM-DD HH:mm:ss' ).format();
}

function getCreatorId(usuarioID, cb) {
  models['imported-user']
  .findOne({
    where: { eid: usuarioID },
    raw: true
  })
  .then( (ui)=> {
    if (!ui || !ui.userId) {
      return null;
    }

    return models.user.findOne({
      where: { id: ui.userId },
      attributes: ['id'],
      raw: true
    });
  })
  .then( (user)=> {
    if (user && user.id) {
      cb(null, user.id);
    } else {
      cb();
    }

    return null;
  })
  .catch(cb);
}

function saveHistoryImage(history, fileName, cb) {
  if (!fileName) return cb();

  we.db.models.image.findOne({
    where: { name: 'old_h_'+fileName }
  })
  .then( (image)=> {
    cb(null, image);
    return null;
  })
  .catch(cb);
}

function resolveRole(perfil) {
  if (!perfil || !perfil.trim || !perfil.trim()) return;

  if (!perfil.split) return;

  let perfis = perfil.split(',');

  let roles = [];

  for (let i = 0; i < perfis.length; i++) {
    let p = perfis[i];

    if (p == 'Admin') {
      roles.push('administrator');
    } else if (p == 'Curador') {
      roles.push('curator');
    }
  }

  return roles;
}

function resolveActivity(data) {
  if (Number(data.catID) === 9999) {
    const cat_outros = data.cat_outros;
    // other:
    if (
      !cat_outros ||
      !cat_outros.trim ||
      !cat_outros.trim()
    ) {
      return [];
    }
    return [cat_outros.trim()];
  }

  if ( cats[data.catID] && cats[data.catID].cat ) {
    return [cats[data.catID].cat];
  }
}

function getHistoryImages(historiaID, cb) {
  let sql = 'SELECT * FROM app_historias_midias '+
    'WHERE historiaID = "'+historiaID+'" '+
      'AND deletedat IS NULL '+
    'ORDER BY midiaID DESC';
  conn.query(sql, (err, results)=> {
    if (err) return cb(err);
    cb(null, results);
  });
}

function getHistoryTexts(historiaID, cb) {
  let sql = 'SELECT * '+
    'FROM `app_historias_textos` '+
    'WHERE historiaID = "'+historiaID+'" '+
    'ORDER BY textoId DESC ';
  conn.query(sql, (err, results)=> {
    if (err) return cb(err);

    results.forEach( (r)=> {
      r.body = r.texto;
    });

    getHistoryFromMidia(historiaID, (err, r)=> {
      if (err) return cb(err);
      results = results.concat(r);
      cb(null, results);
    });
  });
}

function getHistoryFromMidia(historiaID, cb) {
  let sql = 'SELECT app_historias_midias.* , AHMT.texto '+
    'FROM `app_historias_midias` '+
    'LEFT JOIN app_historias_midias_textos AHMT '+
          'ON app_historias_midias.arquivo = AHMT.textoID '+
    'WHERE app_historias_midias.historiaID = "'+historiaID+'" '+
    'AND formato = "texto" '+
    'ORDER BY midiaID DESC ';
  conn.query(sql, (err, results)=> {
    // console.log('>>results>>', results);
    if (err) return cb(err);

    results.forEach( (r)=> {
      if (r.texto) {
        r.body = r.texto;
      } else {
        r.body = r.legenda || '';
      }

    });

    cb(null, results);
  });
}

function getAllV1Histories(cb) {
  let sql = 'SELECT * '+
    'FROM `app_historias` '+
    'WHERE deletedat IS NULL '+
    // 'AND tipo = "video" '+
    'ORDER BY historiaID DESC ';
  conn.query(sql, (err, results)=> {
    if (err) return cb(err);
    cb(null, results);
  });
}

function preloadAllCats(cb) {
  let sql = 'SELECT catID, cat '+
    'FROM `app_catprof` ' +
    'WHERE deletedat IS NULL ';
  conn.query(sql, (err, results)=> {
    if (err) return cb(err);

    for (let i = 0; i < results.length; i++) {
      cats[ results[i].catID ] = results[i];
    }

    cb(null, results);
  });
}

function preloadAllLocations(cb) {
  let sql = 'SELECT nome, uf, localID '+
            'FROM app_local_cidades';
  conn.query(sql, (err, results)=> {
    if (err) return cb(err);

    for (let i = 0; i < results.length; i++) {
      locations[ results[i].localID ] = results[i];
    }

    cb(null, results);
  });
}

function getHistoryTerms(historyId, cb) {
  let sql = 'SELECT AT.* '+
    'FROM app_taxonomy_rel ATR '+
    'LEFT JOIN app_taxonomy AT ON AT.taxID = ATR.taxID '+
    'WHERE historiaID = "'+historyId+'" ';
  conn.query(sql, (err, results)=> {
    if (err) return cb(err);
    cb(null, results);
  });
}

function getHistoryVideos(data, cb) {
  const historyId = data.historyId;

  let sql = 'SELECT DISTINCT AHM.link '+
    'FROM app_historias_midias AHM '+
    'WHERE historiaID = "'+historyId+'" '+
    'AND formato = "video" '+
    'AND deletedat IS NULL '+
    'AND link IS NOT NULL ';
  conn.query(sql, (err, results)=> {
    if (err) return cb(err);

    if (!results) results = [];

    if (data.formato = 'video' && data.link) {
      results.push(data);
    }

    if (!results.length) {
      return cb();
    }

    models['file-url'].findAll({
      where: {
        url: {
          [we.Op.in]: results.map((r)=> {
            return r.link;
          })
        }
      }
    })
    .then( (urls)=> {
      cb(null, urls);
      return null;
    })
    .catch(cb);

  });
}

function doneAll(err) {
  if (err) {
    console.error('MV1H:Done with error', err);
  } else {
    console.log('MV1H:Done all');
  }

  we.exit(process.exit);
}