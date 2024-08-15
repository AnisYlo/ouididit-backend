const express = require('express');
const router = express.Router();

require('../models/connection');
const Transaction = require('../models/transactions');
const User = require('../models/users');
const { checkBody } = require('../modules/checkBody');

// GET : Retrived all transaction for activity //
router.get('/activity/:activityId', async (req, res) => {
        const { activityId } = req.params;

        // Recherche de toutes les transactions associées à une activité spécifique
        const transactions = await Transaction.find({ activity: activityId })
        .populate({
            path : 'user',
            select: '-_id -password', // Don't return user._id && password
        })
        .populate('activity');

        if(transactions !== null)
            res.status(200).json(transactions);
        else
            res.status(404).json({result: false, error: "Transaction not found"});
});


// POST : Create new transaction //
router.post('/:userToken', async (req, res) => {
    if (!checkBody(req.body, ["participants"])) {
        res.json({ result: false, error: "Missing or empty fields" });
        return;
      }

    if(req.params.userToken.length !== 32){ 
        res.status(400).json({result: false, error: "Invalid user token"});
        return;
      }

    const user = await User.findOne({ token: req.params.userToken });
    if (!user) {
        return res.status(404).json({result: false, error: "User not found"});
    }

    const newTransaction = new Transaction({
            user: user._id,
            activity: req.body.activity,
            amount: req.body.amount
        });

    const savedTransaction = await newTransaction.save();
    
    if(savedTransaction !== null)
        res.status(200).json({result : true, savedTransaction});
    else 
        res.status(500).json({result: false, error: "Unable to save transaction"});

});

module.exports = router;