/**
 * Return a list of updates
 *
 * @param  {Object} we we.js object
 * @return {Array}    a list of update objects
 */
function updates() {
  return [{
    version: '0.0.4',
    update(we, done) {
      we.log.info('Start project update v0.0.4');

      const sql = `ALTER TABLE \`histories\`
        ADD COLUMN \`searchData\` TEXT NULL;`;
      we.db.defaultConnection
      .query(sql)
      .then( ()=> {
        we.log.info('Done project update v0.0.4');
        done();
        return null;
      })
      .catch(done);
    }
  }, {
    version: '0.0.5',
    update(we, done) {
      we.log.info('Start project update v0.0.5');

      we.db.models['certification-template']
      .findOrCreate({
        where: {
          identifier: 'history-published'
        },
        defaults: {
          identifier: 'history-published',
          name: 'Histórias publicadas',
          text: 'Teste!!',
          textPosition: 'middle',
          published: true
        }
      })
      .then( ()=> {
        we.log.info('Done project update v0.0.5');
        done();
        return null;
      })
      .catch(done);
    }
  }];
}

module.exports = updates;