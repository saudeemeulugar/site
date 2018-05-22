module.exports = function (projectPath, Widget) {
  let widget = new Widget('latest-histories', __dirname);

  widget.viewMiddleware = function(w, req, res, next) {
    req.we.db.models.history.findAll({
      where: { published: true },
      order: [['publishedAt', 'DESC']],
      limit: 9
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