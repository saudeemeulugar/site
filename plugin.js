/**
 * We.js plugin file, use to load routes and configs
 *
 * @param  {String} projectPath current project path
 * @param  {Object} Plugin      we.js Plugin class
 * @return {Object}             intance of we.js Plugin class
 */

const path = require('path'),
  metatagContentFindAll = require('./lib/metatags/metatagContentFindAll.js'),
  metatagContentFindOne = require('./lib/metatags/metatagContentFindOne.js'),
  metatagHistoryFindAll = require('./lib/metatags/historyFindAll.js'),
  metatagHistoryFindOne = require('./lib/metatags/historyFindOne.js'),
  generateHistoryCertification = require('./lib/generateHistoryCertification.js');

module.exports = function loadPlugin(projectPath, Plugin) {
  const plugin = new Plugin(__dirname);

  plugin.generateHistoryCertification = require('./lib/generateHistoryCertification.js');

  plugin.setConfigs({
    permissions: {
      'access_contents_unpublished': {
        'title': 'Access unpublished contents'
      },
      'view_dashboard': { title: '' },
      'edit_terms_of_use': { title: '' },
      'generate_reports': {
        title: 'Generate reports in admin'
      }
    },

    certification: {
      textPositions: {
        middle: { l: 102, t: 273,
          options: {
            width: 440,
          },
          fontSize: 18
        },
        left: { l: 30, t: 150 },
        right: { l: 400, t: 150 }
      }
    },

    API_KEYS: {
      youtube: {
        client_id: null,
        client_secret: null,
        redirect_uri: null
      }
    },

    forms: {
      'login': __dirname + '/server/forms/login.json',
      'register': __dirname + '/server/forms/register.json',
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

    // 'get /user/:userId/certification': {
    //   name: 'user.certification',
    //   title: 'Certificados',
    //   controller: 'certification',
    //   action: 'find',
    //   template: 'user/certification'
    // },
    // 'get /history/:userId/certification': {
    //   name: 'history.certification',
    //   title: 'Gerar certificado',
    //   controller: 'certification',
    //   action: 'generate'
    // }

    'get /exports/history.csv': {
      controller: 'report',
      action: 'exportHistory',
      permission: 'generate_reports'
    },
    'get /exports/user.csv': {
      controller: 'report',
      action: 'exportUser',
      permission: 'generate_reports'
    },

    'get /exports/history-count-in-states': {
      controller: 'report',
      action: 'exportsHistoryCountInStates',
      permission: 'generate_reports'
    },

    'get /exports/user-count-in-states': {
      controller: 'report',
      action: 'exportsUserCountInStates',
      permission: 'generate_reports'
    },

    'post /history/:id/publish': {
      controller: 'history',
      action: 'publish',
      responseType: 'json',
      permission: 'publish_history'
    }
  });

  plugin.setResource({
    name: 'history',
    findAll: {
      metatagHandler: 'historyFindAll',
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
    findOne: { metatagHandler: 'historyFindOne' }
  });

  plugin.setResource({ name: 'certification' });
  plugin.setResource({ name: 'certification-template' });

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

  plugin.setResource({ name: 'contributor' });

  plugin.setMetatagHandlers = function setMetatagHandlers(we) {
    if (we.router.metatag) {
      // override default metatag handler for all routes:
      we.router.metatag.add('default', require('./lib/metatags/default.js'));
      we.router.metatag.add('contentFindOne', metatagContentFindOne);
      we.router.metatag.add('contentFindAll', metatagContentFindAll);
      we.router.metatag.add('historyFindOne', metatagHistoryFindOne);
      we.router.metatag.add('historyFindAll', metatagHistoryFindAll);
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

    we.express.use('/history', (req, res, next)=> {
      if (!req.query.view) return next();
      req.we.db.models['imported-history']
      .findOne({
        where: { eid: String(req.query.view) }
      })
      .then( (ih)=> {
        if (ih && ih.historyId) {
          res.goTo('/history/'+ih.historyId);
        } else {
          next();
        }
        return null;
      })
      .catch(next);
    });

    we.express.use('/narrador', (req, res, next)=> {
      if (!req.query.view) return next();
      req.we.db.models['imported-user']
      .findOne({
        where: { eid: String(req.query.view) }
      })
      .then( (ih)=> {
        if (ih && ih.userId) {
          res.goTo('/user/'+ih.userId);
        } else {
          next();
        }
        return null;
      })
      .catch(next);
    });

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

  plugin.hooks.on(
    'history:published:after',
    generateHistoryCertification
  );

  return plugin;
};