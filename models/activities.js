const mongoose = require('mongoose');

const activitySchema = mongoose.Schema({
  organizer : { type: mongoose.Schema.Types.ObjectId, ref: 'users' },
  name : String,
  location: {type : String, default: ''},
  date : Date,
  time: Number,
  description : {type : String, default: ''},
  payementLimit : {type : Number, default: 0},
  payementClose: {type : Boolean, default: false},
});

const Activity = mongoose.model('activities', activitySchema);

module.exports = Activity;
