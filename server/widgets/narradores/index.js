module.exports = function (projectPath, Widget) {
  const widget = new Widget('narradores', __dirname);

  widget.viewMiddleware = function(w, req, res, next) {
    req.we.db.models.user.findAll({
      where: {
        haveAvatar: true,
        active: true,
        // publishedHistoryCount: {
        //   [req.we.Op.gt]: 0
        // }
      },
      order: [req.we.db.Sequelize.fn('RAND')],
      limit: 5
    })
    .then( (r)=> {
      w.records = r;
      next();
      return null;
    })
    .catch(next)
  }

  return widget;
};