const youtube = require('../../lib/youtube.js'),
  fs = require('fs');

module.exports = {
  /**
   * Default find action
   *
   * @param  {Object} req express.js request
   * @param  {Object} res express.js response
   */
  find(req, res) {
    return res.locals.Model
    .findAndCountAll(res.locals.query)
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
    // by default record is preloaded in context load
    res.ok();
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

    if (req.method === 'POST') {
      if (req.isAuthenticated && req.isAuthenticated()) {
        req.body.creatorId = req.user.id;
      }

      req.we.utils._.merge(res.locals.data, req.body);

      return res.locals.Model
      .create(req.body)
      .then(function afterCreate (record) {
        res.locals.data = record;
        res.created();
        return null;
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

    switch(req.query.step) {
      case '2':
        res.locals.step2 = true;
        break;
      case '3':
        res.locals.step3 = true;
        break;
      default:
        res.locals.step1 = true;
    }

    if (we.config.updateMethods.indexOf(req.method) >-1) {
      if (!record) {
        return res.notFound();
      }

      if (
        req.files &&
        req.files.videos &&
        req.files.videos.length
      ) {
        const video = req.files.videos[0];

        let fileStream = fs.createReadStream( video.path );
        youtube.upload(fileStream, video, (err, result)=> {
          if (err) {
            return res.queryError(err);
          }

          req.we.log.warn('history:edit:result after upload video:', result.data);

          fileStream.close();
          // delete local video async:
          fs.unlink(video.path, (err) => {
            if (err) we.log.error('history:upload:error on delete file', err);
            we.log.info('youtube:uploader:deleted local video:', video.path);
          });

          req.body.youtubeVideoUrl = 'https://www.youtube.com/watch?v='+result.data.id;

          record.updateAttributes(req.body)
          .then(function reloadAssocs(n) {
            return n.reload()
            .then(function() {
              return n;
            });
          })
          .then(function afterUpdate (newRecord) {
            res.locals.data = newRecord;
            res.updated();
            return null;
          })
          .catch(res.queryError);
        });
      } else {
        record.updateAttributes(req.body)
        .then(function reloadAssocs(n) {
          return n.reload()
          .then(function() {
            return n;
          });
        })
        .then(function afterUpdate (newRecord) {
          res.locals.data = newRecord;
          res.updated();
          return null;
        })
        .catch(res.queryError);
      }
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