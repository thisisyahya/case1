var express = require('express');
var router = express.Router();
const { usersArray, roomsArray } = require("../utils/rooms"); // Import roomsArray correctly
const crypto = require("crypto"); // For generating random names
const { GoogleGenerativeAI } = require("@google/generative-ai");
const passport = require("passport");
require('dotenv').config(); // Load environment variables
const session = require("express-session");
const googleUsers = require("../models/googleUsers");
const rooms = require("../models/rooms");
const mongoose=require("mongoose");
const genAI = new GoogleGenerativeAI("AIzaSyAJ9Gb69tYaRXeK34oQl8Ze3OVwP5Th9WY");
const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });


router.get("/ai", async (req, res) => {
  try {
      const prompt = "Explain how AI works";

      const result = await model.generateContent(prompt);
      const responseText = result.response.text(); // Extract AI-generated text

      res.json({ status: "done", response: responseText });
  } catch (error) {
      console.error("Error generating content:", error);
      res.status(500).json({ error: "Failed to generate AI response" });
  }
});


const ensureAuthenticated = (req, res, next) => {
   // console.log("User in middleware:", req.user); // Debugging

  if (req.isAuthenticated()) {
      req.userId = req.user.googleId; // Keep existing logic
      console.log("User ID set in middleware:", req.userId);
      return next();
  }
  res.redirect("/auth/google"); // Redirect to Google login
};








router.get("/login", (req, res)=>{
   res.render("login");
});

// Google OAuth Login
router.get(
  "/auth/google",
  passport.authenticate("google", { scope: ["profile", "email"] })
);

router.get(
  "/auth/google/callback",
  passport.authenticate("google", { failureRedirect: "/" }),
  (req, res) => {
      res.redirect("/");
  }
);


router.get("/dashboard", ensureAuthenticated, (req, res) => {
  res.json({ message: "Welcome to your dashboard!", user: req.user });
});



router.get("/logout", ensureAuthenticated, (req, res, next) => {
  req.logout((err) => {
    if (err) {
      return next(err);
    }
    res.json({ message: "Logged out successfully!" });
  });
});












// Function to generate a random room name
function generateRoomName(gameCode, maxPlayers) {
  return `${gameCode}${crypto.randomBytes(3).toString("hex")}${maxPlayers}`;
}


router.post("/createroom", ensureAuthenticated, async(req,res)=>{

const gamesCodes = {"Battle Royale":"br","Speed Racer":"sr","Mind Bender":"mb","Lost in Jungle":"lg","Zombie Hunt":"zh"};

let roomId; // Declare roomId in a higher scope

const game = req.body.game;
const maxPlayers = parseInt(req.body.players, 10);

if (gamesCodes[game]) {
    const gameCode = gamesCodes[game]; // Get the respective game code
    roomId = generateRoomName(gameCode, maxPlayers);
    console.log(roomId); // Example output: br3f9c24
} else {
    // Handle error: send response or return appropriate message
    console.log("room is invalid");
}

const newRoom = new rooms({
  roomId,
  maxPlayers,
  game,
  players: [], // Empty at creation
  playerSockets:[] //empty at creation
});

await newRoom.save();

/*
 res.json({
  game:game,
  players:parseInt(maxPlayers),
  roomname,
  roomsArray,
  
}); 
*/

res.redirect(`/game/${roomId}`);
});


router.get("/game/:roomId", ensureAuthenticated, async (req, res) => {



  console.log("Middleware passed"); // ✅ Check if middleware is working



  let roomId = req.params.roomId;

  // Fetch maxPlayers and playerSockets from the database
  const roomData = await rooms.findOne({ roomId: roomId }, { maxPlayers: 1, playerSockets: 1, status: 1, _id: 0 });

  if (!roomData) {
      console.log("Room not found, rendering error page."); // ✅ Debugging log
      return res.render("roomError", { errorMessage: "The room does not exist or is invalid", errorCode: "404" });
  }

  let maxPlayers = roomData.maxPlayers;
  let playerSockets = roomData.playerSockets || [];

  console.log("Room data found:", { maxPlayers, players: playerSockets.length });

  // If the room is full or already being played, return error
  if (playerSockets.length >= maxPlayers && roomData.status === false) {
      console.log("Room is full, rendering error page.");
      
      return res.render("roomError", { errorMessage: "The room is full", errorCode: "403" });
  }

  if (roomData.status === true) {
      console.log("Room is in progress, rendering error page.");
      return res.render("roomError", { errorMessage: "The room is being played", errorCode: "403" });
  }

  // Fetch user details
  let user = await googleUsers.findOne({ googleId: req.userId }).select("name photoUrl -_id").lean();
  let userName = user?.name;
  let userPhoto = user?.photoUrl;

  if (userName && userPhoto) {
      console.log(`User found: ${userName}, photo URL: ${userPhoto}`);
  } else {
      console.log("User not found");
  }

  // Extract game code from roomId
  const gameCode = roomId.slice(0, 2); // First two letters
  const parsedMaxPlayers = parseInt(roomId.slice(-1)); // ✅ Convert to number

  // Game Codes Mapping
  const gamesCodes = {
      "br": "Battle Royale",
      "sr": "Speed Racer",
      "mb": "Mind Bender",
      "lg": "Lost in Jungle",
      "zh": "Zombie Hunt"
  };

  if (!gamesCodes[gameCode] || parsedMaxPlayers > 10) {
      console.log("Invalid room configuration, rendering error page.");
      return res.render("roomError", { errorMessage: "Invalid room configuration", errorCode: "400" });
  }

  let identifierExists = await rooms.findOne({ roomId, identifiers: { $in: [req.userId] } });

if (identifierExists) {
    return res.render("roomError", { errorMessage: "You cannot join the room twice", errorCode: "403" });
}
else{
  console.log(identifierExists);
}


  // Render the game page
  const game = gamesCodes[gameCode];
  console.log(`Rendering game page for ${game}`);

  

  return res.render("game1", { roomId, maxPlayers, game, userId: `${req.userId}` });
});








router.post("/submit-answer", async (req, res) => {
  try {

    const io = req.app.locals.io; // ✅ Access io from app.locals

    const { roomId, socketId, answer } = req.body; // Extract from request body
    console.log(roomId, socketId, answer);

    // Find the player in the room
    let hasAnswered = await rooms.findOne(
      { roomId, "players.playerSocket": socketId },
      { "players.$": 1 }
    );

    // Check if player has already answered
    if (hasAnswered.players[0].playerAnswer !== "") {
      return res.status(403).json({ message: "You have already answered" });
    }

    // Update the player's answer
    let updatedRoom = await rooms.findOneAndUpdate(
      { roomId, "players.playerSocket": socketId },
      { $set: { "players.$.playerAnswer": answer } },
      { new: true }
    );

    if (!updatedRoom) {
      return res.status(404).json({ message: "Room or player not found" });
    }

    console.log(updatedRoom);
    res.status(200).json({ message: "Answer recorded", room: updatedRoom });

    const room = await rooms.findOne({ roomId: roomId });

    if (room && room.players.every(player => player.playerAnswer.trim() !== "")) {
      console.log("All players have submitted their answers.");
  
      let payLoad = [];
  
      room.players.forEach(player => {
          if (player.playerAnswer === room.answer) {
              payLoad.push({ name: player.name, photoUrl: player.photoUrl });
              console.log(`${player.name} answered correctly!`);
          }
      });
  
      if (payLoad.length > 0) {
          io.to(room.roomId).emit("showScore", payLoad); // Emit once after collecting data
      }
      else{
        io.to(room.roomId).emit("showScore", payLoad); // Emit once after collecting data
      }
  
      await rooms.findOneAndDelete({ roomId: room.roomId }); // Delete room after emitting
  } else {
        console.log("Some players have not submitted their answers yet.");
    }
    

  } catch (error) {
    console.error("Error updating answer:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});







/* GET home page. */
router.get("/", (req, res) => {
  console.log("User in request:", req.user);  // ✅ Debugging line
  res.render("home", { user: req.user });
});




module.exports = router;
