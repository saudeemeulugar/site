/**
 * Generate history certification
 *
 * @param  {Object}   we
 * @param  {Object}   history
 * @param  {Function} done      Callback
 */
  module.exports = function generateHistoryCertification(ctx, done) {
    const we = ctx.we,
      history = ctx.history;

    console.log('rodo!');

    if (
      !history ||
      !history.creator ||
      !history.creator.id
    ) {
      return done();
    }

    let tpl,
      cert,
      identifier = 'history-published';

    we.utils.async.series([
      function loadCertificationTemplate(done) {
        we.db.models['certification-template']
        .findOne({
          where: { identifier: identifier }
        })
        .then(function (r) {
          tpl = r;
          done();
          return null;
        })
        .catch((err)=> {
          we.log.error('generateHistoryCertification:err:', err);
          done(err);
        });
      },
      function loadCFR(done) {
        if (!tpl) return done();

        let text = 'A História XXX do Alberto Souza foi publicada dia XX/XX/XXXX';

        const cid = 'history-'+history.id+'-published';

         we.db.models.certification.findOrCreate({
          where: {
            identifier: cid
          },
          defaults: {
            name: 'História publicada',
            text: text,
            identifier: cid,
            userId: history.creator.id,
            templateId: tpl.id
          }
        })
        .spread((c, created)=> {
          if (created) {
            we.log.info('history:certification:created:historyId:'+history.id);
          } else {
            we.log.info('history:certification:exists:historyId:'+history.id);
          }

          cert = c;

          done();
          return null;
        })
        .catch(done);
      }
    ], function (err) {
      if (err) {
        we.log.error('Error in generate user history certification: ', err);
      }
      return done(null, cert);
    });
  }