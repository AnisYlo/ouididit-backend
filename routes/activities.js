var express = require('express');
var router = express.Router();

require('../models/connection');
const Activity = require('../models/activities');
const { checkBody } = require('../modules/checkBody');


// GET : activity informations 
router.get('/:activityId', async (req, res) => {
    if(req.params.activityId.length === 24){ // mongoDB => _id length 24
        Activity.findById(req.params.activityId)
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

    const newActivity = new Activity (req.body);
    newActivity.save()
    .then(data=> data !==null ? res.json({result: true, activityId: data}) : res.status(500).json({result: false, error: "Activity not create"}));
});

module.exports = router;