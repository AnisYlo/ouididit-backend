const mongoose = require('mongoose');

const activitySchema = mongoose.Schema({
  organizer : { type: mongoose.Schema.Types.ObjectId, ref: 'users' },
  name : String,
  location: {
    street : {type : String, default: ''},
    postalCode : {type : Number, default: null},
    city : {type : String, default: ''},
    lat : {type : Number, default: null},
    lng : {type : Number, default: null},
    },
  date : Date,
  time: Number,
  description : {type : String, default: ''},
  payementLimit : {type : Number, default: 0},
  payementClose: {type : Boolean, default: false},
});

const Activity = mongoose.model('activities', activitySchema);

module.exports = Activity;
