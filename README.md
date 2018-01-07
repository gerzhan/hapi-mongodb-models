[![npm version](https://badge.fury.io/js/hapi-mongodb.svg)](http://badge.fury.io/js/hapi-mongodb)
[![Build Status](https://secure.travis-ci.org/Marsup/hapi-mongodb.svg)](http://travis-ci.org/Marsup/hapi-mongodb)
[![Dependencies Status](https://david-dm.org/Marsup/hapi-mongodb.svg)](https://david-dm.org/Marsup/hapi-mongodb)
[![DevDependencies Status](https://david-dm.org/Marsup/hapi-mongodb/dev-status.svg)](https://david-dm.org/Marsup/hapi-mongodb#info=devDependencies)

# Hapi-mongodb-models

A Hapi MongoDB (via Mongoose) plugin. Access one or several connections and optionally expose your model classes through server and request

Options can be a single object with the following keys or an array of the same kind if you need multiple connections :

- url: *Optional.* MongoDB connection string (eg. `mongodb://user:pass@localhost:27017`).
    - defaults to `mongodb://localhost:27017`
- settings: *Optional.* Provide extra settings to the connection, see [documentation](http://mongodb.github.io/node-mongodb-native/driver-articles/mongoclient.html#mongoclient-connect-options).
- decorate: *Optional.* Rather have exposed objects accessible through server and request decorations. You cannot mix different types of decorations.
    - If `true`, `server.db` or `request.db`
    - If it's a string, `server.<string>` or `request.<string>`

Some objects are exposed under `server` and `request` by this plugin:

- `connection` : Mongoose connection object, if an array was provided for the configuration, it will be an array of connections in the same order
- `ObjectID` : mongodb ObjectID constructor in case you need to use it

Usage example :
```js
const Hapi = require('hapi');
const Boom = require('boom');

const launchServer = async function() {
    
    const dbOpts = {
        url: 'mongodb://localhost:27017/test',
        settings: {
            poolSize: 10
        },
        decorate: true
    };
    
    const server = Hapi.Server();
    
    await server.register({
        plugin: require('hapi-mongodb-models'),
        options: dbOpts
    });

   server.route( {
        method: 'GET',
        path: '/users/{id}',
        async handler(request) {

            const db = request.db.connection;
            const ObjectID = request.db.ObjectID;

            try {
                const result = await db.collection('users').findOne({  _id: new ObjectID(request.params.id) });
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
