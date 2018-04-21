module.exports = {
  /**
   * Install function run in we.js project install.
   *
   * @param  {Object}   we    we.js object
   * @param  {Function} done  callback
   */
  install(we, done) {
    we.log.info('Starting project install...');

    const fns = [];
    let u;

    fns.push(function registerUser1(done) {
      const user1 = {
        username: 'admin',
        email: 'alberto.souza.99@gmail.com',
        password: '123', // change after install
        displayName: 'Administrator',
        active: true,
        roles: ['administrator']
      };

      we.log.info('I will create the user: ', user1);

      we.db.models.user.findOrCreate({
        where: { email: user1.email },
        defaults: user1
      })
      .spread( (user)=> {
        u = user;
        we.log.info('New User with id: ', user.id);
        // install we-plugin-auth for use password
        if (!we.db.models.password) {
          done();
          return null;
        }
        // set the password
        return we.db.models.password.create({
          userId: user.id,
          password: user1.password,
          confirmPassword: user1.password
        })
        .then( ()=> {
          done();
          return null;
        });
      })
      .catch(done);
    });

    fns.push(function registerUser2(done) {
      const user1 = {
        username: 'alberto',
        email: 'contato@albertosouza.net',
        password: '123', // change after install
        displayName: 'Alberto',
        active: true,
        roles: []
      };

      we.log.info('I will create the user: ', user1);

      we.db.models.user.findOrCreate({
        where: { email: user1.email },
        defaults: user1
      })
      .spread( (user)=> {
        we.log.info('New User with id: ', user.id);
        // install we-plugin-auth for use password
        if (!we.db.models.password) {
          done();
          return null;
        }
        // set the password
        return we.db.models.password.create({
          userId: user.id,
          password: user1.password,
          confirmPassword: user1.password
        })
        .then( ()=> {
          done();
          return null;
        });
      })
      .catch(done);
    });

    fns.push(function registerHomeSlideshow(done) {
      const data = {
        name: 'Home slideshow',
        creatorId: u.id
      };

      we.db.models.slideshow.create(data)
      .then( ()=> {
        done();
        return null;
      })
      .catch(done);
    });

    fns.push(function createDefaultMenus(done) {
      we.utils.async.series([
        function createMainMenu(done) {
          we.db.models.menu.create({
            name: 'main',
            class: ''
          })
          .then(function (r){
            we.log.info('New menu with name: '+r.name+' and id: '+r.id);
            // then create menu links
            we.db.models.link.bulkCreate([
              {
                href: '/about',
                text: 'Sobre',
                title: 'About',
                menuId: r.id
              },
              {
                href: '/site-contact',
                text: 'Contato',
                title: 'Entre em contato',
                menuId: r.id
              }
            ])
            .then( ()=> {
              done();
              return null;
            })
            .catch(done);

            return null;
          })
          .catch(done);
        },
        function createSocialMenu(done) {
          we.db.models.menu.create({
            name: 'social',
            class: ''
          })
          .then( (r)=> {
            we.log.info('New menu with name: '+r.name+' and id: '+r.id);
            // then create menu links
            we.db.models.link.bulkCreate([
              {
                href: '#',
                text: '<i class="fa fa-facebook"></i>',
                title: 'Example',
                menuId: r.id
              },
              {
                href: '#',
                text: '<i class="fa fa-twitter"></i>',
                title: 'Example',
                menuId: r.id
              }
            ])
            .then( ()=> {
              done();
              return null;
            })
            .catch(done);

            return null;
          })
          .catch(done);
        }
      ], done);
    });

    fns.push(function createFirstPages(done) {
      we.db.models.content
      .create({
        artive: true,
        published: true,
        showInLists: true,
        title: 'Quem somos',
        about: 'Página com as informações sobre a organização',
        body: 'Digite o texto sobre a organização aqui ...',
        publishedAt: new Date(),
        allowComments: false,
        category: 'Página'
      })
      .then( ()=> {
        we.log.info('First contents created');
        done();
        return null
      })
      .catch(done);
    });

    fns.push(function createFirstSettings(done) {
      we.db.models['system-setting']
      .bulkCreate([{
        key: 'siteName',
        value: 'Saúde é meu lugar',
      }, {
        key: 'siteDescription',
        value: `Versão digital da Mostra 'Saúde é Meu Lugar - Vivências no Território`,
      }, {
        key: 'emailContact',
        value: `nao-responda <alberto@linkysystems.com>`,
      }])
      .spread( ()=> {
        we.log.info('First system-setting created');
        done();
        return null
      })
      .catch(done);
    });

    we.utils.async.series(fns, done);
  }
};
