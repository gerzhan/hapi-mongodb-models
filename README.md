# Hapi-mongodb-models

A Hapi MongoDB (via Mongoose) plugin. Access one or several connections and optionally expose your model classes through server and request

Options can be a single object with the following keys or an array of the same kind if you need multiple connections:

- `url`: *Optional.* MongoDB connection string (eg. `mongodb://user:pass@localhost:27017`).
    - defaults to `mongodb://localhost:27017/test`
- `settings`: *Optional.* Provide extra settings to the connection, see [documentation](http://mongodb.github.io/node-mongodb-native/driver-articles/mongoclient.html#mongoclient-connect-options).
- `decorate`: *Optional.* Rather have exposed objects accessible through server and request decorations. You cannot mix different types of decorations.
    - If `true`, `server.db` or `request.db`
    - If it's a string, `server.<string>` or `request.<string>`
- `rootDir`: *Optional.* The root dir path of your project. Used when requiring your models
- `models`: *Optional.* A list of models you want to register. Each item is an object of the shape: 
  ```js
  {path: 'string', collection: 'string', name: 'string'}
  ```

Some objects are exposed under `server` and `request` by this plugin:

- `connection`: Mongoose connection object, if an array was provided for the configuration, it will be an array of connections in the same order
- `ObjectID`: mongodb ObjectID constructor in case you need to use it
- `ModelName`: Your registered models are exposed as `server.db.ModelName` and `request.db.ModelName`.

Options example:
```js
{
  url: 'mongodb://localhost:27017/test',
  settings: {
    poolSize: 10
  },
  rootDir: '/project/root/dir',
  models: [{
    path: 'rootDir/path/to/models/User',
    name: 'UserModel',
    collection: 'users'
  }]
  decorate: true
}
```

Model definition:

A model will receive in its constructor an object with three properties:

* `connection`: The Mongoose connection object
* `collection`: The collection name. It becomes optional if you add a default value to the `collection` param in your model, like the example below.
* `name`: The model name that is used to access the exposed object. If `name` = `UserModel`, it'll be accessible as `server.db.UserModel`. If you don't provide the `name`, the class name is used

Model example:
```js
// models/User.js
const {Schema} = require('mongoose')

const UserSchema = new Schema({
  username: {type: String, required: true, unique: true},
})

class UserModel {
  constructor({connection, name, collection = 'users'}) {
    this.model = connection.model(name, UserSchema, collection)
  }

  async findById(id) {
    return this.model.findById(id).exec()
  }
}
module.exports = UserModel
```

Plugin usage example:
```js
const Path = require('path');
const Hapi = require('hapi');
const Boom = require('boom');

const launchServer = async function() {
    
  // if you don't pass rootDir, you have to pass the full path for each model
  const dbOpts = {
    url: 'mongodb://localhost:27017/test',
    settings: {
      poolSize: 10
    },
    models: [{
      path: Path.join(__dirname, 'models/User'),
    }],
    decorate: true
  };
  
  const server = Hapi.Server();
  
  await server.register({
    plugin: require('hapi-mongodb-models'),
    options: dbOpts
  });

  server.route({
    method: 'GET',
    path: '/users/{id}',
    async handler(request) {
      const {db: {UserModel}, param: {id}} = request;

      try {
        const result = await UserModel.findById(id);
        return result;
      }
      catch (err) {
        throw Boom.internal('Internal MongoDB error', err);
      }
    }
  });

  await server.start();
  console.log(`Server started at ${server.info.uri}`);
};

launchServer().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

## Compatibility level

* Hapi >= 17
* Node.js >= 8

Ships with `mongoose` 5
