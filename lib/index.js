const Path = require('path')
const mongoose = require('mongoose')
const Joi = require('joi')
const pkg = require('../package.json')

mongoose.Promise = global.Promise

const modelSchema = Joi.object({
  name: Joi.string()
    .required()
    .trim(),
  path: Joi.string()
    .required()
    .trim(),
})
const singleOption = Joi.object({
  uri: Joi.string()
    .uri({scheme: 'mongodb'})
    .default('mongodb://localhost:27017/test'),
  settings: Joi.object().default({
    useMongoClient: true,
    socketTimeoutMS: 0,
    keepAlive: 1,
    reconnectTries: 20,
  }),
  decorate: [true, Joi.string()],
  authIndex: Joi.boolean().default(true),
  models: Joi.array().items(modelSchema),
  baseDir: Joi.string().required(),
}).strict()
const optionsSchema = Joi.array()
  .items(singleOption)
  .min(1)
  .single()

// Credits: https://github.com/Marsup/hapi-mongodb
// This plugin was adapted to connect with mongoose
async function register(server, options) {
  const pluginOptions = await optionsSchema.validate(options)
  let expose = {}

  const decorationTypes = new Set(pluginOptions.map(o => typeof o.decorate))
  if (decorationTypes.size > 1) {
    throw new Error('You cannot mix different types of decorate options')
  }

  const registerModels = (connection, {models = [], baseDir = ''}) => {
    const createdModels = {}
    for (const {collection, name, path} of models) {
      const ModelClass = require(Path.join(baseDir, path))
      const modelName = name || ModelClass.name
      createdModels[modelName] = new ModelClass({
        connection,
        collection,
        name: modelName,
      })
    }
    return createdModels
  }

  const connect = async function(options) {
    const connection = await mongoose.connect(options.uri, options.settings)

    // TODO set autoIndex
    const optionsToLog = Object.assign({}, options, {
      uri: options.uri.replace(
        /mongodb:\/\/([^/]+):([^@]+)@/,
        'mongodb://$1:******@',
      ),
    })
    delete optionsToLog.models

    server.log(
      ['mongoose', 'info'],
      'Mongoose connection created for ' + JSON.stringify(optionsToLog),
    )

    if (options.models && options.models.length) {
      const models = registerModels(connection, options)
      expose = {...models, ...expose}
      server.log(['mongoose', 'info'], 'Model classes registered')
    }

    if (typeof options.decorate === 'string') {
      const decoration = {...expose, connection}
      server.decorate('server', options.decorate, decoration)
      server.decorate('request', options.decorate, decoration)
    }
    return connection
  }

  try {
    const dbs = await Promise.all(pluginOptions.map(connect))
    expose.connection = options.length === 1 ? dbs[0] : dbs
  } catch (err) {
    server.log(['mongoose', 'error'], err)
    throw err
  }

  if (decorationTypes.has('boolean')) {
    server.decorate('server', 'db', expose)
    server.decorate('request', 'db', expose)
  } else if (decorationTypes.has('undefined')) {
    for (const key of Object.keys(expose)) {
      server.expose(key, expose[key])
    }
  }

  server.events.on('stop', async () => {
    try {
      await mongoose.disconnect()
      server.log(['mongoose', 'info'], 'Mongoose connection closed')
    } catch (err) {
      server.log(['mongoose', 'error'], err)
    }
  })

  server.log('info', `Plugin registered: ${pkg.name}`)
}

exports.plugin = {register, pkg}
