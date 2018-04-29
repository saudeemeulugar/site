/**
 * We.js plugin file, use to load routes and configs
 *
 * @param  {String} projectPath current project path
 * @param  {Object} Plugin      we.js Plugin class
 * @return {Object}             intance of we.js Plugin class
 */

const path = require('path'),
  metatagContentFindAll = require('./lib/metatags/metatagContentFindAll.js'),
  metatagContentFindOne = require('./lib/metatags/metatagContentFindOne.js');

module.exports = function loadPlugin(projectPath, Plugin) {
  const plugin = new Plugin(__dirname);

  plugin.setConfigs({
    permissions: {
      'access_contents_unpublished': {
        'title': 'Access unpublished contents'
      },
      'view_dashboard': { title: '' },
      'edit_terms_of_use': { title: '' }
    },

    API_KEYS: {
      youtube: {
        client_id: null,
        client_secret: null,
        redirect_uri: null
      }
    },

    forms: {
      'complete-registration': __dirname + '/server/forms/complete-registration.json',
      'history-create': __dirname + '/server/forms/history-create.json',
      'history1': __dirname + '/server/forms/history1.json',
      'history2': __dirname + '/server/forms/history2.json',
      'history3': __dirname + '/server/forms/history3.json',
      'history4': __dirname + '/server/forms/history4.json',
      'history5': __dirname + '/server/forms/history5.json'
    }
  });

  plugin.setRoutes({
    'get /': {
      'controller': 'main',
      'action': 'index',
      'template': 'home/index',
      titleHandler(req, res, next) {
        res.locals.title = '';
        return next();
      }
    },
    'post /newsletter/subscribe': {
      controller: 'newsletter',
      action: 'subscribe',
      responseType: 'json'
    },

    'get /complete-registration': {
      controller: 'main',
      action: 'completeRegistration',
      template: 'user/complete-registration'
    },
    'post /complete-registration': {
      controller: 'main',
      action: 'completeRegistration',
      template: 'user/complete-registration'
    },

    'post /drive/get-upload-url': {
      controller: 'gdrive',
      action: 'getUploadUrl',
      responseType: 'json'
    },
    // upload/complete google drive upload process
    'post /drive/video/:id': {
      controller: 'gdrive',
      action: 'updateVideoMetadata',
      model: 'video',
      responseType: 'modal',
      permission: 'upload_gdrive_video'
    },

    'get /user/:userId/video': {
      controller: 'video',
      action: 'find',
      model: 'video',
      permission: 'find_user_video',
      search: {
        currentUserIs: {
          parser: 'paramIs',
          param: 'userId',
          runIfNull: true,
          target: {
            type: 'field',
            field: 'creatorId'
          }
        }
      }
    },
    'get /api/v1/video/:id([0-9]+)': {
      controller: 'video',
      action: 'findOne',
      model: 'video',
      responseType: 'json',
      permission: 'find_video'
    },
    'delete /api/v1/video/:name': {
      controller: 'video',
      action: 'destroy',
      model: 'video',
      responseType: 'json',
      permission: 'delete_video'
    },
    'get /api/v1/:type(video|audio)/get-form-modal-content': {
      controller: 'video',
      action: 'getFormModalContent',
      model: 'video',
      responseType: 'modal',
      permission: true
    },

    // audio
    'post /drive/get-audio-upload-url': {
      controller: 'gdrive',
      action: 'getAudioUploadUrl',
      responseType: 'json'
    },
    'post /drive/audio/:id': {
      controller: 'gdrive',
      action: 'updateAudioMetadata',
      model: 'audio',
      responseType: 'modal',
      permission: 'upload_gdrive_audio'
    },

    'get /user/:userId/audio': {
      controller: 'audio',
      action: 'find',
      model: 'audio',
      permission: 'find_user_audio',
      search: {
        currentUserIs: {
          parser: 'paramIs',
          param: 'userId',
          runIfNull: true,
          target: {
            type: 'field',
            field: 'creatorId'
          }
        }
      }
    },
    'get /api/v1/audio/:id([0-9]+)': {
      controller: 'audio',
      action: 'findOne',
      model: 'audio',
      responseType: 'json',
      permission: 'find_audio'
    },
    'delete /api/v1/audio/:name': {
      controller: 'audio',
      action: 'destroy',
      model: 'audio',
      responseType: 'json',
      permission: 'delete_audio'
    },

  });

  plugin.setResource({ name: 'history' });

  plugin.setResource({
    name: 'content',
    findAll: {
      metatagHandler: 'contentFindAll',
      search: {
        published: {
          parser: 'equalBoolean',
          target: {
            type: 'field',
            field: 'published'
          }
        }
      }
    },
    findOne: { metatagHandler: 'contentFindOne' }
  });

  plugin.setMetatagHandlers = function setMetatagHandlers(we) {
    if (we.router.metatag) {
      // override default metatag handler for all routes:
      we.router.metatag.add('default', require('./lib/metatags/default.js'));
      we.router.metatag.add('contentFindOne', metatagContentFindOne);
      we.router.metatag.add('contentFindAll', metatagContentFindAll);
    }
  }

  plugin.hooks.on('we-plugin-user-settings:getCurrentUserSettings', (ctx, done)=> {
    // ctx = {req: req,res: res,data: data}
    plugin.we.db.models['system-setting']
    .findAll()
    .then( (r)=> {
      ctx.data.systemSettings = {};

      if (r) {
        r.forEach( (setting)=> {
          ctx.data.systemSettings[setting.key] = setting.value;
        });
      }

      done();
      return null;
    })
    .catch(done);
  });

  plugin.hooks.on('we-plugin-user-settings:getCurrentUserSettings', (ctx, done)=> {
    // ctx = {req: req,res: res,data: data}
    ctx.data.userPermissions = {};

    if (ctx.req.userRoleNames.indexOf('administrator') > -1) {
      // skip if user id admin:
      return done();
    }

    for (let permission in plugin.we.acl.permissions) {

      if (plugin.we.acl.canStatic(permission, ctx.req.userRoleNames)) {
        ctx.data.userPermissions[permission] = true;
      }
    }

    done();
  });

  plugin.bindCPFRequirementRoute = function(we) {
    we.express.use(function(req, res, next) {
      if (
        req.isAuthenticated() &&
        !req.user.allRequirementsMet &&
        req.originalUrl == '/'
      ) {

        // res.addMessage('warning', {
        //   text: 'cpf.passport.required.to.continue'
        // });

        return res.goTo('/complete-registration');
      }

      next();
    });
  }

  plugin.events.on('we:after:load:passport', plugin.bindCPFRequirementRoute);

  plugin.events.on('we:after:load:express', (we)=> {

    if (we.env == 'dev') {
      // Allows cross domain Credentials in ajax
      we.express.use((req, res, next)=>{
        res.set('Access-Control-Allow-Credentials', 'true');
        next();
      });
    }

    we.express.use(plugin.iframeClassMD);
  });

  plugin.iframeClassMD = function iframeClassMD(req, res, next) {
    if (req.query.iframe) {
      res.locals.iframeClass = 'iframe-page-type';
    } else {
      res.locals.iframeClass = '';
    }
    next();
  }

  plugin.events.on('we:after:load:plugins', plugin.setMetatagHandlers);

  plugin.events.on('we:after:load:express', (we)=> {
    const adminFiles = path.join( __dirname, 'client/admin/prod');
    we.express.use('/admin', we.utils.express.static(adminFiles));
  });

  plugin.hooks.on('we:models:before:instance', function (we, done) {
    const brasil = we.gov.br;
    const brValid = brasil.validacoes;

    // o usuário deve preencher o CPF ou o Passaporte de acordo com a flag que diz se ele é brasileiro ou não

    // setando o campo de cpf
    we.db.modelsConfigs.user.definition.cpf = {
      type: we.db.Sequelize.STRING(11),
      unique: true,
      allowNull: true,
      formFieldType: 'gov-br/cpf',
      set: function onSetCPF(val) {
        if (val) {
          // remove a mascara de cpf ao setar o valor
          this.setDataValue('cpf', brasil.formatacoes.removerMascara(val));
        } else {
          this.setDataValue('cpf', null);
        }
      },
      validate: {
        cpfIsValid: function cpfIsValid(val) {
          if (val && !brValid.eCpf(val)) throw new Error('user.cpf.invalid');
        }
      }
    }

    we.db.modelsConfigs.user.definition.estrangeiro = {
      type: we.db.Sequelize.BOOLEAN,
      defaultValue: false,
      formFieldType: 'gov-br/brasileiro-seletor',
      set(val) {
        if (!val) this.setDataValue('estrangeiro', null);
        if ( Number(val) )
          this.setDataValue('estrangeiro', Number(val) );
        this.setDataValue('estrangeiro', null);
      }
    }

    done();
  });

  plugin.CPFOrPassportValidation = function(we, next) {
    we.db.models.user
    .hook('beforeValidate', (user) => {
      let val = user.requerCpfOrPassport;
      // skip cpf and passport requirement if is new record:
      if (user.isNewRecord) {
        return user;
      }

      if (!val || !we.utils._.trim(val)) {
        if (!user.getDataValue('cpf')) {
          // se for brasileiro, deve ter um cpf
          throw new Error('user.cpf.required');
        }
      } else {
        if (!user.getDataValue('passaporte') ) {
          // se não for brasileiro deve ter um passaporte
          throw new Error('user.passaporte.required');
        }
      }
    });

    next();
  };

  plugin.hooks.on('we:models:ready', plugin.CPFOrPassportValidation);

  plugin.addJs('we.component.videoSelector', {
    weight: 20,
    type: 'project',
    path: 'files/public/we.components.videoSelector.js'
  });

  plugin.addJs('we.component.audioSelector', {
    weight: 20,
    type: 'project',
    path: 'files/public/we.components.audioSelector.js'
  });

  return plugin;
};