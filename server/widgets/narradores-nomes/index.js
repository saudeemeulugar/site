module.exports = function (projectPath, Widget) {
  const widget = new Widget('narradores', __dirname);

  widget.viewMiddleware = function(w, req, res, next) {
    req.we.db.models.user.findAll({
      where: {
        active: true,
        displayName: {
          [req.we.Op.ne]: null
        }
      },
      order: [req.we.db.Sequelize.fn('RAND')],
      limit: 12
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