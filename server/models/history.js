/**
 * History model
 */

module.exports = function HModel(we) {
  const model = {
    definition: {
      highlighted: {
        type: we.db.Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
        formFieldType: null
      },
      showInLists: {
        type: we.db.Sequelize.BOOLEAN,
        defaultValue: true,
        formFieldType: null
      },
      allowComments: {
        type: we.db.Sequelize.BOOLEAN,
        defaultValue: true,
        formFieldType: null
      },
      title: {
        type: we.db.Sequelize.STRING,
        allowNull: false
      },
      body: {
        type: we.db.Sequelize.TEXT,
        allowNull: true,
        formFieldType: 'html',
        formFieldHeight: 400
      },
      historyDate: {
        type: we.db.Sequelize.DATE,
        allowNull: true
      },
      published: {
        type: we.db.Sequelize.BOOLEAN,
        defaultValue: false,
        formFieldType: null
      },
      publishedAt: {
        type: we.db.Sequelize.DATE,
        allowNull: true
      },
      uploadedVideoID: {
        type: we.db.Sequelize.STRING,
        allowNull: true
      },
      youtubeVideoUrl: {
        type: we.db.Sequelize.TEXT,
        allowNull: true,
        formFieldType: 'string'
      },
      publishAsAnonymous: {
        type: we.db.Sequelize.BOOLEAN,
        defaultValue: false
      },
      haveText: {
        type: we.db.Sequelize.BOOLEAN,
        defaultValue: true,
        formFieldType: null
      },
      haveImage: {
        type: we.db.Sequelize.BOOLEAN,
        defaultValue: false,
        formFieldType: null
      },
      haveVideo: {
        type: we.db.Sequelize.BOOLEAN,
        defaultValue: false,
        formFieldType: null
      },
      haveAudio: {
        type: we.db.Sequelize.BOOLEAN,
        defaultValue: false,
        formFieldType: null
      },
      country: {
        type: we.db.Sequelize.STRING(5),
        formFieldType: 'location/country',
        defaultValue: 'BR'
      },
      locationState: {
        type: we.db.Sequelize.STRING(10),
        formFieldType: 'location/state',
        formCountryFieldName: 'country'
      },
      city: {
        type: we.db.Sequelize.STRING,
        formFieldType: 'location/city',
        formStateFieldName: 'locationState'
      },
      locationText: {
        type: we.db.Sequelize.VIRTUAL,
        formFieldType: null,
        get() {

          const p = this.get('country');
          if (!p) return '';

          const s = this.get('locationState')
          const c = this.get('city');

          if (c) {
            return s +' / '+ c;
          }

          if (s) {
            return p +' / '+ s;
          }

          return p;
        }
      },
      categoryItem: {
        type: we.db.Sequelize.VIRTUAL,
        get() {
          const category = this.get('category');
          if (category && category.length) {
            return category[0];
          }

          return null;
        }
      },
      setAlias: {
        type: we.db.Sequelize.VIRTUAL
      }
    },

    associations: {
      creator: {
        type: 'belongsTo',
        model: 'user'
      }
    },
    options: {
      // title field, for default title record pages
      titleField: 'title',

      termFields: {
        tags: {
          vocabularyName: null,
          canCreate: true,
          formFieldMultiple: true,
          onlyLowercase: true
        },
        category: {
          vocabularyName: 'Category',
          canCreate: false,
          formFieldMultiple: false
        }
      },

      imageFields: {
        featuredImage: { formFieldMultiple: false },
        images: { formFieldMultiple: true }
      },

      videoFields: {
        videos: { formFieldMultiple: true }
      },

      audioFields: {
        audios: { formFieldMultiple: true }
      },

      fileFields: {
        attachment: { formFieldMultiple: true }
      },
      classMethods: {
        urlAlias(record) {
          return {
            alias: '/historias/' + record.id + '-'+  we.utils.string( record.title )
                   .slugify().s,
            target: '/history/' + record.id,
          };
        }
      },
      // record method for use with record.[method]
      instanceMethods: {},
      hooks: {
        beforeCreate(r) {
          // create an published history and set its publishedDate:
          if (r.published) {
            r.publishedAt = Date.now();
          }

          if (!r.highlighted) {
            r.highlighted = 0;
          }
        },

        beforeUpdate(r) {
          if (r.published && !r.publishedAt) {
            // set publishedAt on publish:
            r.publishedAt = Date.now();
          } else if (!r.published && r.publishedAt) {
            // reset publishedAt on unpublish
            r.publishedAt = null;
          }

          if (!r.highlighted) {
            r.highlighted = 0;
          }
        },

        afterUpdate(r) {
          if (r.changed('published')) {
            if (!r.creatorId || !r.creator) {
              return r;
            }

            let creatorId = r.creatorId || r.creator.id;

            if (r.published) {
              we.db.models.user.incrementPublishedHistoryCount(creatorId)
              .then( ()=> {
                return r;
              });
            } else {
              we.db.models.user.decrementPublishedHistoryCount(creatorId)
              .then( ()=> {
                return r;
              });
            }
          }

          return r;
        }
      }
    }
  };

  return model;
};
