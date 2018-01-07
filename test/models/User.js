const {Schema} = require('mongoose')

const UserSchema = new Schema({
  username: {type: String, required: true, unique: true},
})

/**
 * Create a new model for the users collection
 *
 * @param {object} obj - The init object
 * @param {object} obj.connection - The mongoose connection
 * @param {string} obj.collection - The collection name
 * @param {string} obj.name - The name used to expose the object
 */
class UserModel {
  constructor({connection, collection = 'users', name = 'UserModel'}) {
    this.model = connection.model(name, UserSchema, collection)
  }

  async findById(id) {
    return this.model.findById(id).exec()
  }

  async create({username}) {
    // eslint-disable-next-line
    const newUser = new this.model({username})

    if (await this.exists(username)) {
      throw new Error('username already taken')
    }

    const {_doc: {__v, _id, ...user}} = await newUser.save()
    return {...user, id: _id}
  }

  /**
   * Check if a user is already registered with the given username
   *
   * @param {string} username
   *
   * @return {boolean}
   */
  async exists(username) {
    return this.model
      .findOne({username: {$regex: new RegExp(`^${username}$`, 'i')}})
      .exec()
      .then(u => Boolean(u))
  }
}

module.exports = UserModel
