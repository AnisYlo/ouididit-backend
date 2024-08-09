var express = require('express');
var router = express.Router();

require('../models/connection');
const User = require('../models/users');
const Chat = require('../models/chats');
const { checkBody } = require('../modules/checkBody');

// POST : create new chat //
router.post('/', (req, res) => {
    if (!checkBody(req.body, ['activityId'])) {
        res.json({ result: false, error: 'Missing or empty fields' });
        return;
    }

    const newChat = new Chat ({activity : req.body.activityId});
    newChat.save()
    .then(data=> data !==null ? res.json({result: true, chatId: data._id}) : res.status(500).json({result: false, error: "Chat not create"}));
});

// GET : chat history //
router.get('/:chatId', async (req, res) => {
    if(req.params.chatId.length === 24){ // mongoDB => _id length 24
        Chat.findById(req.params.chatId)
        .populate({
            path : 'messages',
            populate: { path: 'user' }
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

// POST : Send new message //
router.post('/:chatId/:userToken', (req, res) => {
    if (!checkBody(req.body, ['message'])) {
        res.json({ result: false, error: 'Missing or empty fields' });
        return;
    }
    const newMessage = req.body.message;
    
    // Get user id
    User.findOne({ token: req.params.userToken }).select('_id')
    .then(data => {
        if (data !== null) { return data._id }
    })// Send new message
    .then(userId =>{
        Chat.findOneAndUpdate({_id:req.params.chatId},{
            $push :{messages:newMessage}
        }, {new: true})
        .then((message)=>{
            const newMessage = {
                user: userId,
                message: messageContent,
            };

            newMessage.id=message.messages[message.messages.length-1]._id;
            //pusher.trigger(req.params.chatName, 'message', newMessage);
            res.json({ result: true });
        })

    }) 

    
});

module.exports = router;