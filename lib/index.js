const Path = require('path')
const Mongoose = require('mongoose')
const Joi = require('joi')
const pkg = require('../package.json')

Mongoose.Promise = global.Promise

const modelSchema = Joi.object({
  name: Joi.string()
    .optional()
    .trim(),
  path: Joi.string()
    .required()
    .trim(),
})
const singleOption = Joi.object({
  url: Joi.string()
    .uri({scheme: 'mongodb'})
    .default('mongodb://localhost:27017/test'),
  settings: Joi.object(),
  decorate: [true, Joi.string()],
  // authIndex: Joi.boolean().default(true),
  models: Joi.array().items(modelSchema),
  rootDir: Joi.string(),
}).strict()
const optionsSchema = Joi.array()
  .items(singleOption)
  .min(1)
  .single()

async function register(server, options) {
  const pluginOptions = await optionsSchema.validate(options)
  let expose = {
    ObjectId: Mongoose.Types.ObjectId,
  }

  const decorationTypes = new Set(pluginOptions.map(o => typeof o.decorate))
  if (decorationTypes.size > 1) {
    throw new Error('You cannot mix different types of decorate options')
  }

  const registerModels = (connection, {models = [], rootDir = ''}) => {
    const createdModels = {}
    for (const {collection, name, path} of models) {
      const ModelClass = require(Path.join(rootDir, path))
      // lowercase 1st letter
      let modelName = ModelClass.name.replace(/\b\w/g, l => l.toLowerCase())
      const exposeName = name || modelName

      createdModels[exposeName] = new ModelClass({
        connection,
        collection,
        name: exposeName,
      })
    }
    return createdModels
  }

  const connect = async function(options) {
    const mongoose = new Mongoose.Mongoose()
    const connection = await mongoose.connect(options.url, options.settings)

    // TODO set autoIndex
    const optionsToLog = {
      ...options,
      url: options.url.replace(
        /mongodb:\/\/([^/]+):([^@]+)@/,
        'mongodb://$1:******@',
      ),
    }

    server.log(
      [pkg.name, 'info'],
      `Mongoose connection created for ${JSON.stringify(optionsToLog)}`,
    )

    if (options.models && options.models.length) {
      const models = registerModels(connection, options)
      expose = {...models, ...expose}
      server.log([pkg.name, 'info'], 'Model classes registered')
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
    expose.connection = pluginOptions.length === 1 ? dbs[0] : dbs
  } catch (err) {
    server.log([pkg.name, 'error'], err)
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
      // TODO make sure is disconnecting when there multiple connections
      // since it creates one mongoose instance for each connection
      await Mongoose.disconnect()
      server.log([pkg.name, 'info'], 'Mongoose connection closed')
    } catch (err) {
      server.log([pkg.name, 'error'], err)
    }
  })

  server.log('info', `Plugin registered: ${pkg.name}`)
}

exports.plugin = {register, pkg}
