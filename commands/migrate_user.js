
const migration = require('../lib/migration.js'),
  request = require('request'),
  fs = require('fs');

let we, conn, models, async, LS;
let cats = {};

module.exports = function Command (program, helpers) {

  program
  .command('migrate-user')
  .alias('MV1U')
  .description('Comando para migrar os usuários importados')
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

        preloadAllCats(()=> {
          importAll(doneAll);
        });
      });

    });
  });
};

function importAll(cb) {
  getAllV1Users( (err, users)=> {
    if (err) return cb(err);

    async.eachSeries(users, (user, next)=> {
      setTimeout( ()=> {

        checkIfIsImported(user.usuarioID, (err, isImported)=> {
          if (err) return next(cb);

          if (isImported) {
            we.log.info('--> Already inported: ', user.email);
            next();
          } else {
            we.log.info('--> Will import one: ', user.email);
            // delay on each import:
            importOne(user, next);
          }
        });

      }, 300);
    }, cb);
  });
}

function parseD(d) {
  if (!d) return null;
  return we.utils.moment(d, 'YYYY-MM-DD HH:mm:ss' ).format();
}

function checkIfIsImported(usuarioID, cb) {
  models['imported-user'].findOne({
    where: { eid: usuarioID },
    attributes: ['id'],
    raw: true
  })
  .then( (r)=> {
    cb(null, Boolean(r) );
    return null;
  })
  .catch(cb);
}

function importOne(data, cb) {
  if (!data.email) {
    we.log.info('email is required', data);
    return cb();
  }

  const du = {
    username: null,
    email: data.email,
    // password: '',
    displayName: data.nicename,
    fullName: data.nome,
    cpf: data.cpf,
    phone: data.telefone || null,
    biography: data.about || null,
    active: true,
    atividade: resolveActivity(data),
    createdAt: parseD(data.createdat),
    updatedAt: parseD(data.updatedat),
    roles: resolveRole(data.perfil)
  };

  models.user.findOrCreate({
    where: { email: du.email },
    defaults: du
  })
  .spread( (r, created)=> {
    return new Promise( (resolve, reject)=> {
      convertUserFoto({
        data: data,
        user: r
      }, (err, image)=> {
        if (err) return reject(err);
        if (!image) return resolve(r);
        // update db user
        r.set('avatar', [image]);
        r.save()
        .then(function afterSetAvatar () {
          resolve(r);
          return null;
        })
        .catch(reject);
      });
    });
  })
  .then( (r)=> {
    return models['imported-user'].findOrCreate({
      where: { eid: data.usuarioID },
      defaults: {
        eid: data.usuarioID,
        userId: r.id,
        status: 'imported'
      }
    })
    .spread( ()=> {
      return r;
    });
  })
  .then( ()=> {
    cb();
    return null;
  })
  .catch( (err)=> {
    if (err && err.name == 'SequelizeValidationError') {
      we.log.error(err);
      cb();
      return ;
    }

    cb(err);
  });
}

function convertUserFoto(ctx, cb) {
  const user = ctx.user;
  const data = ctx.data;
  if (!data.foto) return cb();

  let fileName = data.foto.toString();

  if (!fileName) return cb();
  if (fileName.indexOf('.') === -1) {
    fileName+= '.jpg';
  }

  let url = 'https://www.saudeemeulugar.com/static/narrador/'+fileName;

  we.log.info('URL to download foto:'+url);

  fileName = 'old_'+fileName;

  let dest = LS.getPath('original', fileName);

  we.log.info('Will save foto in:'+dest);

  let file = fs.createWriteStream(dest);

  const stream = request({ url: url })
  .pipe(file);

  stream.on('error', we.log.error);
  stream.on('finish', ()=> {
    saveImage(user, data, fileName, cb)
  });
}

function saveImage(user, data, fileName, cb) {
  let file = {
    name: fileName,
    storageName: 'localImages',
    isLocalStorage: true,
    creatorId: user.id,
    label: user.displayName+ ' foto',
    path: LS.getPath('original', fileName)
  };

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

    models.image.create(file)
    .then( (record)=> {
      if (record) we.log.debug('New image record created:', record.get());
      cb(null, record);
      return null;
    })
    .catch(cb);
  });
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

function getAllV1Users(cb) {
  let sql = 'SELECT * '+
    'FROM `app_usuarios` '+
    'WHERE deletedat IS NULL '+
    'ORDER BY id DESC ';
  conn.query(sql, (err, results, fields)=> {
    if (err) return cb(null, err);
    cb(null, results);
  });
}

function preloadAllCats(cb) {
  let sql = 'SELECT catID, cat '+
    'FROM `app_catprof` ' +
    'WHERE deletedat IS NULL ';
  conn.query(sql, (err, results, fields)=> {
    if (err) return cb(null, err);

    for (let i = 0; i < results.length; i++) {
      cats[ results[i].catID ] = results[i];
    }

    cb(null, results);
  });
}

function doneAll(err) {
  if (err) {
    console.error('MV1U:Done with error', err);
  } else {
    console.log('MV1U:Done all');
  }

  we.exit(process.exit);
}