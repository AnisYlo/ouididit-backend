const mongoose = require('mongoose');

const transactionSchema = mongoose.Schema({
  user : { type: mongoose.Schema.Types.ObjectId, ref: 'users' },
  activity : { type: mongoose.Schema.Types.ObjectId, ref: 'activities' },
  amount : Number,
  date : {type: Date, default: Date.now},
});

const Transaction = mongoose.model('transactions', transactionSchema);

module.exports = Transaction;
