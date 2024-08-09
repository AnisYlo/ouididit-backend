const mongoose = require('mongoose');

const messageSchema = mongoose.Schema({
    user : { type: mongoose.Schema.Types.ObjectId, ref: 'users' },
    message : String,
    type: {
        type : String,
        enum: ['Message', 'Event'],
        default: 'Message',
        },
    createdAt : {type: Date, default: Date.now},
});

const chatSchema = mongoose.Schema({
    activity : { type: mongoose.Schema.Types.ObjectId, ref: 'activities' },
    messages : [messageSchema],
});

const Chat = mongoose.model('chats', chatSchema);

module.exports = Chat;