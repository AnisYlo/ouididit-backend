var express = require('express');
var router = express.Router();

require('../models/connection');
const Pusher = require('pusher');
const Chat = require('../models/chats');
const User = require('../models/users');
const Participant = require('../models/participants');
const { checkBody } = require('../modules/checkBody');

// Init pusher settings
const pusher = new Pusher({
    appId: process.env.PUSHER_APPID,
    key: process.env.PUSHER_KEY,
    secret: process.env.PUSHER_SECRET,
    cluster: process.env.PUSHER_CLUSTER,
    useTLS: true,
});


// POST : create new chat //
router.post('/', (req, res) => {
    if (!checkBody(req.body, ['activityId'])) {
        res.json({ result: false, error: 'Missing or empty fields' });
        return;
    }

    const newChat = new Chat ({activity : req.body.activityId});
    newChat.save()
    .then(data => {
        if(data !== null) { res.json({result: true, chatId: data._id}) } 
        else res.status(500).json({result: false, error: "Chat not create"});
    });
});

// GET : chat history //
router.get('/:chatId', (req, res) => {
    if(req.params.chatId.length === 24){ // mongoDB => _id length 24
        Chat.findById(req.params.chatId)
        .populate({
            path : 'messages',
            populate: { 
                path: 'user',
                select: '-_id username avatar', // Don't return user._id
            }
        })
        .then(chat => {
            const result = chat !== null;
            res.json({ result, messages : chat.messages });
        });
    } else {
        res.status(500).json({result: false, error: "Wrong chat Id"});
        return;
    }
});

// GET : Find chat by activity and get history //
router.get('/find/:activityId', (req, res) => {
    if(req.params.activityId.length === 24){ // mongoDB => _id length 24
        Chat.findOne({activity : req.params.activityId})
        .populate({
            path : 'messages',
            populate: { 
                path: 'user',
                select: '-_id username avatar', // Don't return user._id
            }
        })
        .then(chat => {
            const result = chat !== null;
            res.json({ result, messages : chat.messages });
        });
    } else {
        res.status(500).json({result: false, error: "Wrong chat Id"});
        return;
    }
});

// PUT : User join chat //
router.put('/:chatId/:userToken', (req, res) => {
    let userId={};
    let activityId={};

    // Retreive activity from this chat
    Chat.findOne({ _id: req.params.chatId }).select('activity')
    .then(data => {
        if (data !== null) { return data.activity }
        else res.status(500).json({result: false, error: "Error during retriving activity"})
    })
    .then(tempActivityId =>{
        // Save activity ID
        activityId = tempActivityId
        // Get user ID
        User.findOne({ token: req.params.userToken }).select('_id')
        .then(data => {
            if (data !== null) { return data._id }
            else res.status(500).json({result: false, error: "Error during finding user"})
        })
        .then(tempId =>{
            // Save user ID
            userId = tempId;
            Participant.findOne({ user: userId, activity: activityId }).select('_id')
            .then(data => {
                if (data !== null) { // Connect user to PUSHER
                    pusher.trigger(req.params.chatId, 'join', {username: req.params.userToken});
                    res.json({ result: true });
                } else{
                    res.status(401).json({ result: false, error : "User unauthorized to join this chanel" });
                }
            })
        })
    })
});

// POST : Send new message //
router.post('/:chatId/:userToken', (req, res) => {
    if (!checkBody(req.body, ['messageText', 'avatar', 'username'])) {
        res.json({ result: false, error: 'Missing or empty fields' });
        return;
    }
    
    // Get user id
    User.findOne({ token: req.params.userToken }).select('_id')
    .then(data => {
        if (data !== null) { return data._id }
        else res.status(500).json({result: false, error: "Error during finding user"})
    })// Send new message
    .then(userId =>{
        const newMessage = {
            user: userId,
            message: req.body.messageText,
            type: 'Message',
        };
        Chat.findOneAndUpdate({_id:req.params.chatId},{
            $push :{messages:newMessage}
        }, {new: true})
        .then((chat)=>{
            console.log(chat);
            const messageAdded = chat.messages[chat.messages.length-1]
            const pusherMessage = {
                text : messageAdded.message,
                userToken : req.params.userToken,
                userName : req.params.username,
                userAvatar : req.body.avatar,
                createdAt: messageAdded.createdAt,
                id: messageAdded._id,
            }
            pusher.trigger(req.params.chatId, 'message', pusherMessage);
            res.json({ result: true });
        })
    })
});

// DELETE : User Leave chat //
router.delete('/:chatId/:userToken', (req, res) => {
    let userId = {};
    // Get user id
    User.findOne({ token: req.params.userToken }).select('_id')
    .then(data => {
        if (data !== null) { return data._id }
        else res.status(500).json({result: false, error: "Error during finding user"})
    })
    .then(tempId =>{
        // Save user ID
        userId = tempId;
        //Remove previous leave for the user
        Chat.updateOne(
            {_id:req.params.chatId},
            { $pull: { messages: { type: "Event", user: userId } } }
        )// After send new leave event
        .then(()=>{
            const newMessage = {
                user: userId,
                message: "User leave",
                type: "Event",
            };
            Chat.findOneAndUpdate({_id:req.params.chatId},{
                $push :{messages:newMessage}
            })// Disconect user from PUSHER
            .then(()=>{
                console.log("User leave =>",userId);
                pusher.trigger(req.params.chatId, 'leave', {username: req.params.userToken});
                res.json({ result: true });
            })
        })
    })
});

module.exports = router;