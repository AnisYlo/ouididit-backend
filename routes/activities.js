var express = require("express");
var router = express.Router();

require("../models/connection");
const Activity = require("../models/activities");
const User = require("../models/users");
const Participant = require("../models/participants");
const { checkBody } = require("../modules/checkBody");

// GET : activity informations //
router.get("/:activityId/:userToken", async (req, res) => {
  if (req.params.activityId.length !== 24) {
    // mongoDB => _id length 24
    res.status(400).json({ result: false, error: "Invalid activity Id" });
    return;
  }

  Activity.findById(req.params.activityId)
    .populate("organizer")
    .then((activity) => {
      // console.log('route backend activity', activity)
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

  // Store error and participant info in addError
  let addError = { result: true, participants: [] };

  // Create an array of promises to handle all participants
  const participantPromises = req.body.participants.map((participant) => {
    return User.findOne({ email: participant.email })
      .then((data) => {
        if (data === null) {
          // If user does not exist, create them in DB
          const newUser = new User({
            email: participant.email,
          });
          return newUser.save().then((newUser) => newUser);
        } else {
          return data;
        }
      })
      .then((userDb) => {
        const newParticipant = new Participant({
          user: userDb._id,
          activity: req.params.activityId,
          status: participant.status,
        });
        return newParticipant.save().then((data) => {
          if (data === null) {
            addError.result = false;
            addError.participants.push(participant.email);
            return null;
          } else {
            return {
              participantId: userDb._id,
              email: userDb.email,
              avatar: userDb.avatar,
              username: userDb.username,
              status: participant.status,
            };
          }
        });
      });
  });

  // Wait for all promises to resolve
  Promise.all(participantPromises)
    .then((results) => {
      // Filter out any null results (failed participants)
      const successfulParticipants = results.filter(
        (result) => result !== null
      );

      if (addError.result) {
        res.json({ result: true, participants: successfulParticipants });
      } else {
        res
          .status(500)
          .json({
            result: false,
            error: "Error during adding participants",
            participants: addError.participants,
          });
      }
    })
    .catch((error) => {
      res
        .status(500)
        .json({
          result: false,
          error: "An unexpected error occurred",
          details: error,
        });
    });
});

// GET : Participation status for user in all activity //
router.get("/participants/all/:userToken", (req, res) => {
  if (req.params.userToken.length !== 32) {
    res.status(400).json({ result: false, error: "Invalid user token" });
    return;
  }

  User.findOne({ token: req.params.userToken })
    .select("_id")
    .then((userData) => {
      if (userData !== null) {
        return userData._id;
      } else res.status(404).json({ result: false, error: "User not found" });
    })
    .then((userId) => {
      Participant.find({ user: userId })
        .select("status activity")
        .then((userStatus) => {
          if (userStatus !== null)
            res.status(200).json({ result: true, status: userStatus });
          else
            res
              .status(404)
              .json({ result: false, error: "Participation not found" });
        });
    });
});

// GET : Participation status for user in activity //
router.get("/participants/:activityId/:userToken", (req, res) => {
  if (req.params.activityId.length !== 24) {
    // mongoDB => _id length 24
    res.status(400).json({ result: false, error: "Invalid activity Id" });
    return;
  }

  if (req.params.userToken.length !== 32) {
    res.status(400).json({ result: false, error: "Invalid user token" });
    return;
  }

  User.findOne({ token: req.params.userToken })
    .select("_id")
    .then((userData) => {
      if (userData !== null) {
        return userData._id;
      } else res.status(404).json({ result: false, error: "User not found" });
    })
    .then((userId) => {
      Participant.findOne({ user: userId, activity: req.params.activityId })
        .select("status")
        .then((participantStatus) => {
          if (participantStatus !== null)
            res
              .status(200)
              .json({ result: true, status: participantStatus.status });
          else
            res
              .status(404)
              .json({ result: false, error: "Participation not found" });
        });
    });
});

// Route pour récupérer les participants d'une activité
router.get("/participants/:activityId", async (req, res) => {
  if (req.params.activityId.length !== 24) {
    // mongoDB => _id length 24
    res.status(400).json({ result: false, error: "Invalid activity Id" });
    return;
  }
  try {
    const { activityId } = req.params;

    // Trouver les participants associés à l'ID de l'activité
    const participants = await Participant.find({
      activity: activityId,
    }).populate({
      path: "user",
      select: "-password -token", // Don't return password && token
    });

    // Vérifier si des participants ont été trouvés
    if (!participants || participants.length === 0) {
      return res
        .status(404)
        .json({ message: "Aucun participant trouvé pour cette activité" });
    }

    // Envoyer la liste des participants en réponse
    res.status(200).json(participants);
  } catch (error) {
    // Gérer les erreurs éventuelles
    console.error("Erreur lors de la récupération des participants:", error);
    res
      .status(500)
      .json({
        message: "Erreur serveur lors de la récupération des participants",
      });
  }
});

// Route pour supprimer un participant par son ID
router.delete("/participants/:participantId", async (req, res) => {
try {    
  const { participantId } = req.params;
    console.log("id du participant ===>", participantId);

    // Chercher et supprimer le participant par son ID
    const  deletedParticipant = await Participant.deleteOne({ user : participantId });

    console.log("participant trouvé obj ===>", deletedParticipant)
    // Vérifiez si le participant a été trouvé et supprimé
    if (!deletedParticipant) {
      return res.status(404).json({ message: "Participant non trouvé" });
    }

    // Envoyer une réponse de succès
    if (deletedParticipant.deletedCount) {
      console.log('======>')
      res.status(200).json({ message: "Participant supprimé avec succès"});
    }
  } catch (error) {
    // Gérer les erreurs éventuelles
    console.error("Erreur lors de la suppression du participant:", error);
    res
      .status(500)
      .json({
        message: "Erreur serveur lors de la suppression du participant",
      });
  }
});

// PUT : Update activity information
router.put("/:activityId/:userToken", async (req, res) => {
  // Vérifier la longueur de l'ID MongoDB (_id doit être une chaîne de 24 caractères)
  if (req.params.activityId.length !== 24) {
    return res.status(400).json({ result: false, error: "Invalid activity Id" });
  }

  try {
    // Récupérer l'activité pour vérifier son existence
    const activity = await Activity.findById(req.params.activityId);
    if (!activity) {
      return res.status(404).json({ result: false, error: "Activity not found" });
    }

    const userToken = req.params.userToken;
    if (!userToken) {
      return res.status(401).json({ result: false, error: "Unauthorized: Invalid token" });
    }

    // Vérifier si l'utilisateur est autorisé à modifier cette activité
    if (activity.organizer.toString() !== userToken) {
      return res.status(403).json({ result: false, error: "Forbidden: You cannot update this activity" });
    }

    // Mettre à jour les champs autorisés
    const allowedUpdates = ["name", "location", "date", "time", "description"];
    const updates = {};
    allowedUpdates.forEach((field) => {
      // Si les champs sont remplis alors on pourra les modifier
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    });

    const updateResult = await Activity.updateOne(
      { _id: req.params.activityId },
      { $set: updates }
    );
// Vérification de la mise à jour de l'activité, si un input est modifié alors il affichera le message true avec la valeur modifiée
    if (updateResult.modifiedCount > 0) {
      res.json({ result: true, message: "Activity updated", modifiedCount: updateResult.modifiedCount });
    } else {
      res.status(400).json({ result: false, error: "Activity not updated" });
    }
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ result: false, error: "Internal server error" });
  }
});

module.exports = router;
