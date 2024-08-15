var express = require("express");
var router = express.Router();

require("../models/connection");
const Participants = require("../models/participants")
const User = require("../models/users");
const { checkBody } = require("../modules/checkBody");
const uid2 = require("uid2");
const bcrypt = require("bcrypt");



router.get('/:token/activities', (req,res) => {
  User.findOne({token: req.params.token}).then((data)=> {
    
    if (data){
      Participants.find({user: data._id})
      .populate({
        path: 'activity',
        populate: {
          path: 'organizer',
          select: '-_id -password', // Exclude _id and password
        },
      })
      .then((activities) => {
        let allActivities = activities.map(object => {return object.activity})
        allActivities = allActivities.sort((a,b) => new Date(b.date) - new Date(a.date))
      res.json({result: true, allActivities })
     })

    }else{
      res.json({result: false})
    }
  })
})

router.get("/:token", (req, res) => {
User.findOne({token: req.params.token}).then((data) => {
  if (data){
    res.json({result: true, token: data.token})
  }else{
    res.json({result: false})
  }
})

}) 

router.get("/info/:token", (req, res) => {
  User.findOne({token: req.params.token}).then((data) => {
    if (data){
      res.json({result: true, user: data})
    }else{
      res.json({result: false})
    }
  })
  
  }) 
//sign up and verify if missing or empty fields -tested-
router.post("/signup", (req, res) => {
  if (!checkBody(req.body, ["email", "password", "username"])) {
    res.json({ result: false, error: "Missing or empty fields" });
    return;
  }

  // Check if the user has not already been registered -tested-
  User.findOne({ email: req.body.email }).then((data) => {
    const hash = bcrypt.hashSync(req.body.password, 10);
    if (data === null) {

      const newUser = new User({
        email: req.body.email,
        username: req.body.username,
        password: hash,
        token: uid2(32),
      });
      newUser.save().then((newDoc) => {        
        res.json({ result: true, newDoc });        
      });
    } else {
      //verifier si token exist 
      if(data.token ===''){
        User.findOneAndUpdate({_id : data._id},{
          $set:{
            username: req.body.username,
            password: hash,
            token: uid2(32),
          }
        }, {new: true})
        .then((newDoc) => {        
          res.json({ result: true, newDoc });       
        });
      }else
      // User already exists in database -tested-
      res.json({ result: false, error: "User already exists" });
    }
  });
});

//missing or empty fields during connection -tested-
router.post("/signin", (req, res) => {
  if (!checkBody(req.body, ["email", "password"])) {
    res.json({ result: false, error: "Missing or empty fields" });
    return;
  }

  // user not found or wrong password -tested-
  User.findOne({ email: req.body.email}).then((data) => {
    if (data && bcrypt.compareSync(req.body.password, data.password)) {
      res.json({ result: true, data});
    } else {
      res.json({ result: false, error: "User not found or wrong password" });
    }
  });
});



module.exports = router;
