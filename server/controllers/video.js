const youtube = require('../../lib/youtube.js');

module.exports = {
  authenticate(req, res) {
    // authenticate to get refresh token
    youtube.authenticate( (err, result)=> {
      if (err) return res.serverError(err);
      res.redirect(result.authUrl)
    });
  },

  refreshToken(req, res) {
    if (!req.query.code) {
      req.we.log.warn('youtube:Unknow response on receive refresh token:', req.query);
      return res.badRequest('Algo errado aconteceu na requisição de permissão para enviar vídeos para o youtube');
    }

    youtube.getTokenFromResumptionCode(req.query.code)
    .then( (tokens)=> {
      if (!tokens.refresh_token) {
        res.goTo('/');
      } else {
        // first auth, save the refresh_token:
        req.we.plugins['we-plugin-db-system-settings']
        .setConfigs({
          youtubeRefreshToken: tokens.refresh_token
        }, (err)=> {
          if (err) return res.queryError(err);
          res.addMessage('success', {
            text: 'Integração com o youtube realizada com sucesso.'
          });
          res.goTo('/');
        });
      }
    });

  }
};