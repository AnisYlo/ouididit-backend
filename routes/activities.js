var express = require("express");
var router = express.Router();

require("../models/connection");
const Activity = require("../models/activities");
const User = require("../models/users");
const Participant = require("../models/participants");
const { checkBody } = require("../modules/checkBody");

// GET : activity informations //
router.get("/:activityId", async (req, res) => {
  if(req.params.activityId.length !== 24){ // mongoDB => _id length 24
    res.status(400).json({result: false, error: "Invalid activity Id"});
    return;
  }
  
  Activity.findById(req.params.activityId)
    .populate("organizer")
    .then((activity) => {
      const result = activity !== null;
      res.json({ result, activity });
    });
});

// POST : create new activity //
router.post("/", (req, res) => {
  if (!checkBody(req.body, ["organizer", "name", "date", "time"])) {
    res.json({ result: false, error: "Missing or empty fields" });
    return;
  }

  let activity = req.body;
  // récupération de l'Id utilisateur pour enregistrement en BDD
  User.findOne({ token: activity.organizer })
    .select("_id")
    .then((userId) => {
      activity.organizer = userId;
    })
    .then(() => {
      const newActivity = new Activity(activity);
      newActivity
        .save()
        .then((data) =>
          data !== null
            ? res.json({ result: true, activity: data })
            : res
                .status(500)
                .json({ result: false, error: "Activity not create" })
        );
    });
});

// POST : Add participants to activity //
router.post("/participants/:activityId", (req, res) => {
  if (!checkBody(req.body, ["participants"])) {
    res.json({ result: false, error: "Missing or empty fields" });
    return;
  }
  // Store error and mail in addError
  let addError = { result: true, participants: [] };

  // For each participant in array
  req.body.participants.map((participant) => {
    User.findOne({ email: participant.email })
      .select("_id")
      .then((data) => {
        if (data === null) {
          // If user not exist, create them in DB
          const newUser = new User({
            email: participant.email,
          });
          newUser.save().then((newUser) => {
            return newUser._id;
          });
        } else {
          return data._id;
        }
      })
      .then((participantId) => {
        const newParticipant = new Participant({
          user: participantId,
          activity: req.params.activityId,
          status: participant.status,
        });
        newParticipant.save().then((data) => {
          // Check add participant, if error : save participant who create error
          if (data === null) {
            addError.result = false;
            addError.participants.push(participant.email);
          }
        });
      });
  });
  addError.result
    ? res.json({ result: true })
    : res
        .status(500)
        .json({ result: false, error: "Error during added participants" });
});

//route put pour mettre à jour les activités
router.put("/:activityId", (req, res) => {
  if (!checkBody(req.body, ["name", "date", "time", "description"])) {
    res.json({ result: false, error: "Missing or empty fields" });
    return;
  }
  Activity.updateOne({_id: req.params.activityId},
    {
      $set: {
        name: req.body.name,
        location: {
          street : req.body.street,
          postalCode : req.body.postalCode,
          city : req.body.city,
          lat : req.body.lat,
          lng : req.body.lng,
        },
        date: req.body.date,
        time: req.body.time,
        description: req.body.description,
      },
    }).then((data) => {
      if (data.modifiedCount > 0) {
        res.json({ result: true, message: "Activity updated", modifiedCount: data.modifiedCount });
      } else {
        res.json({ result: false, error: "Activity not updated" });
      }
    });
});


module.exports = router;
