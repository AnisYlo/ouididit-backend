const mongoose = require('mongoose');

const participantSchema = mongoose.Schema({
  user : { type: mongoose.Schema.Types.ObjectId, ref: 'users' },
  activity : { type: mongoose.Schema.Types.ObjectId, ref: 'activities' },
  status : {
    type : String,
    enum: ['Accepted', 'Pending'],
    default: 'Pending'},
});

const Participant = mongoose.model('participants', participantSchema);

module.exports = Participant;
