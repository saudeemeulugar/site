const { google } = require('googleapis');

// // very basic example of uploading a video to youtube
// function runSample (fileName, callback) {
//   const fileSize = fs.statSync(fileName).size;await
//   const res = await youtube.videos.insert({
//     part: 'id,snippet,status',
//     notifySubscribers: false,
//     resource: {
//       snippet: {
//         title: 'Node.js YouTube Upload Test',
//         description: 'Testing YouTube upload via Google APIs Node.js Client'
//       },
//       status: {
//         privacyStatus: 'private'
//       }
//     },
//     media: {
//       body: fs.createReadStream(fileName)
//     }
//   }, {
//     // Use the `onUploadProgress` event from Axios to track the
//     // number of bytes uploaded to this point.
//     onUploadProgress: evt => {
//       const progress = (evt.bytesRead / fileSize) * 100;
//       process.stdout.clearLine();
//       process.stdout.cursorTo(0);
//       process.stdout.write(`${Math.round(progress)}% complete`);
//     }
//   });
//   console.log('\n\n');
//   console.log(res.data);
//   return res.data;
// }

const scopes = [
  'https://www.googleapis.com/auth/youtube.upload',
  'https://www.googleapis.com/auth/youtube'
];

const YT = {
  we: null,
  oAuth2Client: null,

  init(we) {
    this.we = we;

    we.hooks.on('system-settings:started', function (we, done) {
      YT.configure();
      done();
    });

    we.events.on('system-settings:updated:after', function (we) {
      YT.configure(we);
    });
  },

  configure() {
    try {
      const yConfig = this.we.config.API_KEYS.youtube;
      const ss = this.we.systemSettings || {};

      this.oAuth2Client = new google.auth.OAuth2(
        ss.youtubeClientID || yConfig.client_id,
        ss.youtubeClientSecret || yConfig.client_secret,
        yConfig.redirect_uri || 'http://localhost:9400/auth/youtube/refresh-token'
      );

      if (this.we.systemSettings.youtubeRefreshToken) {
        this.oAuth2Client.credentials = {
          refresh_token: this.we.systemSettings.youtubeRefreshToken
        };

        this.refreshAccessToken((err)=>{
          if (err) console.log('err>>', err);
        });
      }
    } catch (e) {
      console.error(e);
    }
  },

  authenticate(cb) {
    // grab the url that will be used for authorization
    const authorizeUrl = this.oAuth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: scopes.join(' ')
    });

    cb(null, { authUrl: authorizeUrl });
  },

  getTokenFromResumptionCode(authCode) {
    return new Promise( (resolve, reject)=> {
      if (!authCode) {
        return reject('Não foi possível realizar o upload do vídeo: (authCode is required)');
      }
      this.oAuth2Client
      .getToken(authCode)
      .then( (result)=> {
        this.oAuth2Client.credentials = result.tokens;
        resolve(result.tokens);
      })
      .catch(reject);
    });
  },


  refreshAccessToken(cb) {
    this.oAuth2Client.refreshAccessToken()
    .then( (tokens)=> {
      if (!tokens.refresh_token) {
        tokens.refresh_token = this.we.systemSettings.youtubeRefreshToken;
      }

      this.oAuth2Client.credentials = tokens;

      cb(null, this.oAuth2Client);
    })
    .catch(cb);
  },

  refreshAccessTokenIfNeed(cb) {
    if (
      !this.oAuth2Client.credentials ||
      !this.oAuth2Client.credentials.access_token ||
      this.oAuth2Client.isTokenExpiring()
    ) {
      this.refreshAccessToken(cb);
    } else {
      cb();
    }
  },

  upload(fileStream, file, cb) {
    this.refreshAccessTokenIfNeed( (err)=> {
      if (err) return cb(err);

      this.doOneUpload(fileStream, file, (err, result)=> {
        if (err) {
          console.log('EROOR on doOneUpload', err);
          return cb(err);
        }

        cb(null, result);
      });
    });
  },

  doOneUpload(fileStream, file, cb) {
    if (!fileStream) {
      return cb('fileStream is required');
    }

    // initialize the Youtube API library
    const youtube = google.youtube({
      version: 'v3',
      auth: this.oAuth2Client
    });

    return youtube.videos.insert({
      part: 'id,snippet,status',
      notifySubscribers: false,
      resource: {
        snippet: {
          title: 'Node.js YouTube Upload Test',
          description: 'Testing YouTube upload via Google APIs Node.js Client'
        },
        status: {
          // privacyStatus: 'unlisted',
          privacyStatus: 'private'
        }
      },
      media: { body: fileStream }
    }, {
      // Use the `onUploadProgress` event from Axios to track the
      // number of bytes uploaded to this point.
      onUploadProgress: (evt)=> {
        const progress = (evt.bytesRead / Number(file.size)) * 100;
        process.stdout.clearLine();
        process.stdout.cursorTo(0);
        process.stdout.write(`${Math.round(progress)}% complete`);
      }
    })
    .then( (result)=> {
  // result.data:
  //  { kind: 'youtube#video',
  //    etag: '"ZG3FIn5B5vcHjQiQ9nDOCWdxwWo/P86p-puoS2sShh68o9eleSVe1Os"',
  //    id: 'kISCPtgUgvg',
  //    snippet:
  //     { publishedAt: '2018-04-24T00:27:05.000Z',
  //       channelId: 'UCdj8doYt13GTr8ZO1mnmFSA',
  //       title: 'Node.js YouTube Upload Test',
  //       description: 'Testing YouTube upload via Google APIs Node.js Client',
  //       thumbnails: [Object],
  //       channelTitle: 'Alberto Souza',
  //       categoryId: '28',
  //       liveBroadcastContent: 'none',
  //       localized: [Object] },
  //    status:
  //     { uploadStatus: 'uploaded',
  //       privacyStatus: 'private',
  //       license: 'youtube',
  //       embeddable: true,
  //       publicStatsViewable: true } } }



      cb(null, result);
      return null;
    })
    .catch(cb);
  }
};

module.exports = YT;
