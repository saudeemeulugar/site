const editSteps = {
  1: {
    id: 1,
    label: 'Descrição',
    title: 'Descreva sua história',
    form: 'history1',
  },
  2: {
    id: 2,
    label: 'Imagens',
    title: 'Imagens',
    form: 'history2',
  },
  3: {
    id: 3,
    label: 'Vídeo',
    title: 'Vídeo',
    form: 'history3',
  },
  4: {
    id: 4,
    label: 'Audios',
    title: 'Audios',
    form: 'history4',
  },
  5: {
    id: 5,
    label: 'Publicação',
    title: 'Publicação',
    form: 'history5',
  }
};

module.exports = {
  /**
   * Default find action
   *
   * @param  {Object} req express.js request
   * @param  {Object} res express.js response
   */
  find(req, res) {
    const models = req.we.db.models;

    return res.locals.Model
    .findAndCountAll(res.locals.query)
    // reload creators to get tags and related data from hooks:
    .then(function (result) {
      let creatorsIds = result.rows.map( (r)=> {
        if (!r.creator || !r.creator.id) return;
        return r.creator.id;
      });

      return models.user
      .findAll({
        where: { id: creatorsIds }
      })
      .then( (creators)=> {
        const cOjb = {};

        creators.forEach( (c)=> {
          if (!cOjb[c.id]) {
            cOjb[c.id] = c;
          }
        });

        result.rows.forEach( (r)=> {
          if (!r.creator || !r.creator.id) return;
          r.creator = cOjb[ r.creator.id ];
        });

        return result;
      });
    })
    .then(function afterFindAndCount (record) {
      res.locals.metadata.count = record.count;
      res.locals.data = record.rows;
      res.ok();
      return null;
    })
    .catch(res.queryError);
  },

  /**
   * Default count action
   *
   * Built for only send count as JSON
   *
   * @param  {Object} req express.js request
   * @param  {Object} res express.js response
   */
  count(req, res) {
    return res.locals.Model
    .count(res.locals.query)
    .then( (count)=> {
      res.status(200).send({ count: count });
      return null;
    })
    .catch(res.queryError);
  },
  /**
   * Default findOne action
   *
   * Record is preloaded in context loader by default and is avaible as res.locals.data
   *
   * @param  {Object} req express.js request
   * @param  {Object} res express.js response
   */
  findOne(req, res, next) {
    if (!res.locals.data) {
      return next();
    }

    const models = req.we.db.models;

    if (!res.locals.data.creator) {
      return res.ok();
    }

    models.user.findById(res.locals.data.creator.id)
    .then( (creator)=> {
      res.locals.data.creator = creator;
      return res.ok();
    })
    .catch(res.queryError);

  },
  /**
   * Create and create page actions
   *
   * @param  {Object} req express.js request
   * @param  {Object} res express.js response
   */
  create(req, res) {
    if (!res.locals.template) {
      res.locals.template = res.locals.model + '/' + 'create';
    }

    if (!res.locals.data) {
      res.locals.data = {};
    }

    res.locals.steps = editSteps;

    if (req.method === 'POST') {
      if (req.isAuthenticated && req.isAuthenticated()) {
        req.body.creatorId = req.user.id;
      }

      req.we.utils._.merge(res.locals.data, req.body);

      return res.locals.Model
      .create(req.body)
      .then(function afterCreate (record) {
        res.locals.data = record;

        if (req.body.avancar) {
          return res.goTo('/history/'+record.id+'/edit?step=2');
        }

        return res.created();
      })
      .catch(res.queryError);
    } else {
      res.ok();
    }
  },
  /**
   * Edit, edit page and update action
   *
   * Record is preloaded in context loader by default and is avaible as res.locals.data
   *
   * @param  {Object} req express.js request
   * @param  {Object} res express.js response
   */
  edit(req, res) {
    const we = req.we;
    if (!res.locals.template) {
      res.locals.template = res.local.model + '/' + 'edit';
    }

    let record = res.locals.data;

    res.locals.steps = editSteps;

    if (req.query.step && editSteps[req.query.step]) {
      res.locals.stepId = req.query.step;
    } else {
      res.locals.stepId = 1;
    }

    res.locals['step'+res.locals.stepId] = true;
    res.locals.currentStep = res.locals.stepId;
    res.locals.currentStepOBJ = editSteps[res.locals.stepId];

    if (we.config.updateMethods.indexOf(req.method) >-1) {
      if (!record) {
        return res.notFound();
      }
      return editResponse(req, res, record);
    } else {
      res.ok();
    }
  },

  /**
   * Delete and delete action
   *
   * @param  {Object} req express.js request
   * @param  {Object} res express.js response
   */
  delete(req, res) {
    if (!res.locals.template) {
      res.locals.template = res.local.model + '/' + 'delete';
    }

    let record = res.locals.data;

    if (!record) {
      return res.notFound();
    }

    res.locals.deleteMsg = res.locals.model + '.delete.confirm.msg';

    if (req.method === 'POST' || req.method === 'DELETE') {
      record
      .destroy()
      .then(function afterDestroy () {
        res.locals.deleted = true;
        res.deleted();
        return null;
      })
      .catch(res.queryError);
    } else {
      res.ok();
    }
  }
};

function editResponse(req, res, record) {
  record.updateAttributes(req.body)
  .then(function reloadAssocs(n) {
    return n.reload()
    .then(function() {
      return n;
    });
  })
  .then(function afterUpdate () {
    let nextStep = 1;

    if (req.body.next) nextStep = Number(res.locals.currentStep)+1;
    if (req.body.previus) nextStep = Number(res.locals.currentStep)-1;

    if (req.body.saveAndView) {
      return res.goTo('/history/'+record.id);
    } else if (editSteps[nextStep]) {
      return res.goTo('/history/'+record.id+'/edit?step='+ nextStep);
    }
  })
  .catch(res.queryError);
}