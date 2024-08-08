const mongoose = require('mongoose');

const userSchema = mongoose.Schema({
  email: String,
  username: String,
  password: String,
  token: String,
  avatar: 
  { type: String,
    default: '../assets/avatarDefault.png',
  }

});

const User = mongoose.model('users', userSchema);

module.exports = User;