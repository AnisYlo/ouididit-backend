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
        else res.status(500).json({result: false, error: "Chat not created"});
    });
});

// GET : chat history //
router.get('/:chatId', (req, res) => {
    if(req.params.chatId.length !== 24){ // mongoDB => _id length 24
        res.status(400).json({result: false, error: "Invalid chat Id"});
        return;
    }

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
});

// GET : Find chat by activity and get history //
router.get('/find/:activityId', (req, res) => {
    if(req.params.activityId.length !== 24){ // mongoDB => _id length 24
        res.status(400).json({result: false, error: "Invalid activity Id"});
        return;
    }
    
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
        res.json({ result, chat });
    });
});


// GET : Count new messages //
router.get('/:chatId/:userToken', (req, res) => {
    if(req.params.chatId.length !== 24){ // mongoDB => _id length 24
        res.status(400).json({result: false, error: "Invalid chat Id"});
        return;
    }

    if(req.params.userToken.length !== 32){ 
        res.status(400).json({result: false, error: "Invalid user token"});
        return;
    }

    Chat.findById(req.params.chatId)
    .populate({
        path : 'messages',
        populate: { 
            path: 'user',
            select: '-_id token', // Don't return user._id
        }
    })
    .then(chat => {
        // Find last logoff for the user
        const lastLogoff = chat.messages.filter(msg => msg.type === 'Event' && msg.user.token === req.params.userToken)
        
        let newMessagesCount = 0;
        // If user wasn't logoff from the chat all messages are new
        if(lastLogoff.length === 0){
            newMessagesCount = chat.messages.filter(msg => msg.type === 'Message').length;
        } else {
            // Count number of new messages 
            newMessagesCount = chat.messages.filter(msg => msg.type === 'Message' && msg.createdAt > lastLogoff[0].createdAt).length;
        }

        const result = chat !== null;
        res.json({ result, newMessagesCount });
    });
});

// PUT : User join chat //
router.put('/:chatId/:userToken', (req, res) => {
    if(req.params.chatId.length !== 24){ // mongoDB => _id length 24
        res.status(400).json({result: false, error: "Invalid chat Id"});
        return;
    }

    if(req.params.userToken.length !== 32){ 
        res.status(400).json({result: false, error: "Invalid user token"});
        return;
    }

    let user={};
    let activityId={};

    // Retreive activity from this chat
    Chat.findOne({ _id: req.params.chatId }).select('activity')
    .then(data => {
        if (data !== null) { return data.activity }
        else res.status(404).json({result: false, error: "Activity not found"})
    })
    .then(tempActivityId =>{
        // Save activity ID
        activityId = tempActivityId
        // Get user ID
        User.findOne({ token: req.params.userToken }).select('_id username')
        .then(data => {
            if (data !== null) { return data }
            else res.status(404).json({result: false, error: "User not found"})
        })
        .then(tempUser =>{
            // Save user ID
            user = tempUser;
            Participant.findOne({ user: user._id, activity: activityId }).select('_id')
            .then(data => {
                if (data !== null) { // Connect user to PUSHER
                    console.log("User join =>",user.username);
                    pusher.trigger(req.params.chatId, 'join', {userName: user.username});
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

    if(req.params.chatId.length !== 24){ // mongoDB => _id length 24
        res.status(400).json({result: false, error: "Invalid chat Id"});
        return;
    }

    if(req.params.userToken.length !== 32){ 
        res.status(400).json({result: false, error: "Invalid user token"});
        return;
    }
    
    // Get user id
    User.findOne({ token: req.params.userToken }).select('_id')
    .then(data => {
        if (data !== null) { return data._id }
        else res.status(404).json({result: false, error: "User not found"})
    })// Send new message
    .then(userId =>{
        const newMessage = {
            user: userId,
            message: req.body.messageText,
            type: 'Message',
        }; // Save new message in DB
        Chat.findOneAndUpdate({_id:req.params.chatId},{
            $push :{messages:newMessage}
        }, {new: true})
        .then((chat)=>{
            // Last message of the chat
            const messageAdded = chat.messages[chat.messages.length-1]
            const pusherMessage = {
                text : messageAdded.message,
                userToken : req.params.userToken,
                userName : req.params.username,
                userAvatar : req.body.avatar,
                createdAt: messageAdded.createdAt,
                id: messageAdded._id,
            } // Send message to Pusher
            pusher.trigger(req.params.chatId, 'message', pusherMessage);
            res.json({ result: true });
        })
    })
});

// DELETE : User Leave chat //
router.delete('/:chatId/:userToken', (req, res) => {
    if(req.params.chatId.length !== 24){ // mongoDB => _id length 24
        res.status(400).json({result: false, error: "Invalid chat Id"});
        return;
    }

    if(req.params.userToken.length !== 32){ 
        res.status(400).json({result: false, error: "Invalid user token"});
        return;
    }

    let user = {};
    // Get user infos
    User.findOne({ token: req.params.userToken }).select('_id username')
    .then(data => {
        if (data !== null) { return data }
        else res.status(500).json({result: false, error: "Error during finding user"})
    })
    .then(tempUser =>{
        // Save user ID
        user = tempUser;
        //Remove previous leave for the user
        Chat.updateOne(
            {_id:req.params.chatId},
            { $pull: { messages: { type: "Event", user: user._id } } }
        )// After send new leave event
        .then(()=>{
            const newMessage = {
                user: user.id,
                message: "User leave",
                type: "Event",
            };
            Chat.findOneAndUpdate({_id:req.params.chatId},{
                $push :{messages:newMessage}
            })// Disconect user from PUSHER
            .then(()=>{
                console.log("User leave =>",user.username);
                pusher.trigger(req.params.chatId, 'leave', {username: user.username});
                res.json({ result: true });
            })
        })
    })
});

// DELETE : chat delete//
router.delete('/:chatId', (req, res) => {
    if (req.params.chatId.length !== 24) { // mongoDB => _id length 24
        return res.status(400).json({ result: false, error: "Invalid chat ID" });
    }

    Chat.findByIdAndDelete(req.params.chatId)
    .then(data =>{
        if (data) {
            res.json({ result: true, message: "Chat deleted successfully" });
        } else {
            res.status(404).json({ result: false, error: "Chat not found" });
        }
    });
});

module.exports = router;