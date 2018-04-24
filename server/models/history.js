/**
 * History model
 */

module.exports = function HModel(we) {
  const model = {
    definition: {
      active: {
        type: we.db.Sequelize.BOOLEAN,
        defaultValue: true,
        formFieldType: null
      },
      published: {
        type: we.db.Sequelize.BOOLEAN,
        defaultValue: false,
        formFieldType: null
      },
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
      publishedAt: {
        type: we.db.Sequelize.DATE,
        allowNull: true
      },

      // videos: {
      //   type: we.db.Sequelize.VIRTUAL,
      //   formFieldType: 'video-upload'
      // },

      youtubeVideoUrl: {
        type: we.db.Sequelize.TEXT,
        allowNull: true,
        formFieldType: 'string'
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
        }
      }
    }
  };

  return model;
};
