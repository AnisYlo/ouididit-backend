var express = require('express');
var router = express.Router();

require('../models/connection');
const Activity = require('../models/activities');
const User = require('../models/users');
const { checkBody } = require('../modules/checkBody');


// GET : activity informations 
router.get('/:activityId', async (req, res) => {
    if(req.params.activityId.length === 24){ // mongoDB => _id length 24
        Activity.findById(req.params.activityId)
        .populate('organizer')
        .then(activity => {
            const result = activity !== null;
            res.json({ result, activity });
        });
    } else {
        res.status(500).json({result: false, error: "Wrong activity Id"});
        return;
    }
});

// POST : create new activity //
router.post('/', (req, res) => {
    if (!checkBody(req.body, ['organizer', 'name', 'date', 'time'])) {
        res.json({ result: false, error: 'Missing or empty fields' });
        return;
    }
    
    let activity = req.body;
    // récupération de l'Id utilisateur pour enregistrement en BDD
    User.findOne({token : activity.organizer }).select('_id').then(userId=>{
        activity.organizer=userId
    }).then(()=>{
        const newActivity = new Activity (activity);
        newActivity.save()
        .then(data=> data !==null ? res.json({result: true, activityId: data}) : res.status(500).json({result: false, error: "Activity not create"}));
    });
});

module.exports = router;