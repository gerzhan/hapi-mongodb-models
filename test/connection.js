const Path = require('path')
const Hapi = require('hapi')
const Lab = require('lab')
const pkg = require('../package.json')
const Mongoose = require('mongoose')
const {describe, it, beforeEach, expect} = (exports.lab = Lab.script())

describe('Hapi server', () => {
  let server

  beforeEach(() => {
    server = Hapi.Server()
  })

  it('should reject invalid options', async () => {
    try {
      await server.register({
        plugin: require('../'),
        options: {urri: 'mongodb://localhost:27017/test'},
      })
    } catch (err) {
      expect(err).to.exist()
    }
  })

  it('should reject invalid decorate', async () => {
    try {
      await server.register({
        plugin: require('../'),
        options: {decorate: 1},
      })
    } catch (err) {
      expect(err).to.exist()
    }
  })

  it('should fail with no mongodb listening', async () => {
    try {
      await server.register({
        plugin: require('../'),
        options: {url: 'mongodb://localhost:27018'},
      })
    } catch (err) {
      expect(err).to.exist()
    }
  })

  it('should register the plugin with just URL', async () => {
    await server.register({
      plugin: require('../'),
      options: {url: 'mongodb://localhost:27017'},
    })
  })

  it('should register the plugin with no plugin options', async () => {
    await server.register({plugin: require('../')})
    const plugin = server.plugins[pkg.name]
    expect(plugin.connection).to.exist()
    expect(plugin.connection).to.be.instanceof(Mongoose.Mongoose)
  })

  it('should log configuration upon successfull connection', async () => {
    let logEntry
    server.events.once('log', entry => {
      logEntry = entry
    })

    await server.register({
      plugin: require('../'),
      options: {url: 'mongodb://localhost:27017'},
    })

    expect(logEntry.data).to.exist()
    expect(logEntry.data)
      .to.be.a.string()
      .and.contain('mongodb://localhost:27017')
  })

  it('should register the plugin with URL and settings', async () => {
    await server.register({
      plugin: require('../'),
      options: {
        url: 'mongodb://localhost:27017',
        settings: {poolSize: 10},
      },
    })
  })

  it('should find the plugin exposed objects', async () => {
    await server.register({
      plugin: require('../'),
      options: {url: 'mongodb://localhost:27017'},
    })

    server.route({
      method: 'GET',
      path: '/',
      handler(request) {
        const plugin = request.server.plugins[pkg.name]
        expect(plugin.conenction).to.exist()
        expect(plugin.ObjectId).to.exist()
        return Promise.resolve(null)
      },
    })

    await server.inject({method: 'GET', url: '/'})
  })

  it('should find the plugin on decorated objects', async () => {
    await server.register({
      plugin: require('../'),
      options: {
        url: 'mongodb://localhost:27017',
        decorate: true,
      },
    })

    expect(server.db.connection).to.exist()
    expect(server.db.ObjectId).to.exist()

    server.route({
      method: 'GET',
      path: '/',
      handler(request) {
        expect(request.db.connection).to.exist()
        expect(request.db.ObjectId).to.exist()
        return Promise.resolve(null)
      },
    })

    await server.inject({method: 'GET', url: '/'})
  })

  it('should find the plugin on custom decorated objects', async () => {
    await server.register({
      plugin: require('../'),
      options: {
        url: 'mongodb://localhost:27017',
        decorate: 'mongo',
      },
    })

    expect(server.mongo.connection).to.exist()
    expect(server.mongo.ObjectId).to.exist()

    server.route({
      method: 'GET',
      path: '/',
      handler(request) {
        expect(request.mongo.connection).to.exist()
        expect(request.mongo.ObjectId).to.exist()
        return Promise.resolve(null)
      },
    })

    await server.inject({method: 'GET', url: '/'})
  })

  it('should fail to mix different decorations', async () => {
    try {
      await server.register({
        plugin: require('../'),
        options: [
          {url: 'mongodb://localhost:27017', decorate: true},
          {url: 'mongodb://localhost:27017', decorate: 'foo'},
        ],
      })
    } catch (err) {
      expect(err).to.be.an.error(
        'You cannot mix different types of decorate options',
      )
    }
  })

  it('should be able to have multiple connections', async () => {
    await server.register({
      plugin: require('../'),
      options: [
        {url: 'mongodb://localhost:27017/test0'},
        {url: 'mongodb://localhost:27017/test1'},
      ],
    })

    const plugin = server.plugins[pkg.name]
    expect(plugin.connection)
      .to.be.an.array()
      .and.to.have.length(2)
    plugin.connection.forEach((conn, i) => {
      expect(conn).to.be.instanceof(Mongoose.Mongoose)
      expect(conn.connections[0].db.databaseName).to.be.equal(`test${i}`)
    })
  })

  it('should register models and access them via plugin', async () => {
    await server.register({
      plugin: require('../'),
      options: {
        url: 'mongodb://localhost:27017/test',
        rootDir: Path.join(__dirname, '../'),
        models: [{path: 'test/models/User'}],
      },
    })

    const plugin = server.plugins[pkg.name]
    expect(plugin.userModel).to.exist()
  })

  it('should register models with custom name and expose it', async () => {
    await server.register({
      plugin: require('../'),
      options: {
        url: 'mongodb://localhost:27017/test',
        rootDir: Path.join(__dirname, '../'),
        models: [
          {
            path: 'test/models/User',
            name: 'UserClass',
          },
        ],
      },
    })

    const plugin = server.plugins[pkg.name]
    expect(plugin.UserClass).to.exist()
  })

  it('should register models expose them via server', async () => {
    await server.register({
      plugin: require('../'),
      options: {
        url: 'mongodb://localhost:27017/test',
        decorate: true,
        models: [
          {
            path: Path.join(__dirname, '../', 'test', 'models', 'User'),
          },
        ],
      },
    })

    expect(server.db.userModel).to.exist()

    server.route({
      method: 'GET',
      path: '/',
      handler(request) {
        expect(request.db.userModel).to.exist()
        return Promise.resolve(null)
      },
    })

    await server.inject({method: 'GET', url: '/'})
  })

  it('should disconnect if the server stops', async () => {
    await server.register({plugin: require('../')})

    // TODO make sure all connections are closed
    await server.initialize()
    await server.stop()
  })
})
