var createError = require('http-errors');
var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');
var http = require('http');  // Import HTTP module
const { Server } = require('socket.io');  // Import Socket.IO
const mongoose = require('mongoose');
require('dotenv').config(); // Load environment variables
const googleUsers = require("./models/googleUsers");
const rooms = require("./models/rooms");
const sendHtmlEmail = require("./emailService");

const generateCase = require("./functions/generateCase");


 


// MongoDB Connection
const mongoURI = "mongodb+srv://themultiblogsmania:rL7zZOXD33a0YQh1@cluster0.iey9bd2.mongodb.net/chat?retryWrites=true&w=majority&appName=Cluster0";

mongoose.connect(mongoURI)
  .then(() => console.log("✅ MongoDB Connected"))
  .catch(err => console.error("❌ MongoDB Connection Error:", err));




var indexRouter = require('./routes/index');
var usersRouter = require('./routes/users');

var app = express();
var server = http.createServer(app); // Create an HTTP server


// ✅ Attach Socket.IO to the HTTP server
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// ✅ Store `io` globally in `app.locals`
app.locals.io = io;



io.on("connection",(socket)=>{
  console.log("user connected with id :", socket.id);

  socket.on("gameJoined", async (data) => { // Make the callback async

let roomId = data.roomId;
let userId = data.userId;
let socketId = socket.id;

    socket.data.roomId = roomId; // Store room ID in socket
    socket.data.userId = userId; // Store user ID in socket
    try {
        
        let user = await googleUsers.findOne({ googleId: userId }).select("name photoUrl -_id").lean();
        
        let userName = user?.name;  
        let userPhoto = user?.photoUrl; 

        if (userName && userPhoto) {
            console.log(`User found in app: ${userName}, photo url : ${userPhoto}`);
          } else {
            userName = "player";
            userPhoto = "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcT8AJM9wkP__z2M-hovSAWcTb_9XJ6smy3NKw&s";
          }
    

          const updatedRoom = await rooms.findOneAndUpdate(
            { roomId: roomId }, // Find room by ID
            {  
                $push: { 
                    players: {  
                        name: userName,                   
                        photoUrl: userPhoto,
                        playerSocket: socket.id, // ✅ Merge into one $push object
                      
                        
                    },
                    identifiers:userId,
                    playerSockets:socket.id,
                }
            },
            { new: true } // Return the updated document
        );
        
       
        // Fetch playerSockets
let playerSocketsData = await rooms.findOne(
  { roomId: roomId }, 
  { playerSockets: 1, _id: 0 } // ✅ Fetch only playerSockets (Exclude _id)
);

 let maxPlayers = await rooms.findOne(
              { roomId: roomId }, 
              { maxPlayers: 1, _id: 0 } // ✅ Fetch only maxPlayers (Exclude _id)
            );

        let playerSockets = playerSocketsData ? playerSocketsData.playerSockets : [];
         maxPlayers = maxPlayers ? maxPlayers : 0;

         if(maxPlayers === 0 || playerSockets.length === 0){
           io.emit("transfere","/");
         }

        console.log(`Player Sockets: ${playerSockets.length} maxPlayers: ${maxPlayers}`);

  if(maxPlayers !== 0){
        if(playerSockets.length >= maxPlayers.maxPlayers){
          await rooms.findOneAndUpdate(
            { roomId: roomId }, // Filter to find the room
            { $set: { status: true } }, // Update operation
            { new: true } // Returns the updated document
        );
        }

         socket.join(roomId);
        io.to(roomId).emit("updatePlayers", { players: updatedRoom.players});
      }

        console.log("Updated room:", updatedRoom);

        // Example usage when needed
generateCase(roomId, io);

      
    } catch (error) {
      console.error("Error fetching resul:", error);
    }




  });


  socket.on("sendMsg", (data) => {
    console.log(data.msg, data.socketId);
    io.to(socket.data.roomId).emit("receiveMsg", { msg: data.msg, sender: socket.id });
});

socket.on("answerSubmitted", (data) => {
  console.log(data.socketId);
  io.to(socket.data.roomId).emit("submittedAnswer", data); // ✅ Corrected
});



  socket.on("disconnect", async () => {
    console.log("User disconnected:", socket.id);
    
    let updatedAfterDeletion = await rooms.findOneAndUpdate(
      { roomId: socket.data.roomId }, // ✅ Find room by ID
      { 
          $pull: { 
              players: { playerSocket: socket.id }, // ✅ Remove player by socket ID
              identifiers: socket.data.userId, // ✅ Remove user ID from identifiers array
              playerSockets: socket.id // ✅ Remove socket ID from playerSockets array
          } 
      },
      { new: true } // ✅ Return the updated document
  );
  
 
  if (updatedAfterDeletion) {
    if (updatedAfterDeletion.players.length > 0) {
        io.to(socket.data.roomId).emit("updatePlayers", { players: updatedAfterDeletion.players });
        console.log(updatedAfterDeletion);
        console.log("Room has players left");
    } else {
        console.log("No players left, deleting room...");
        await rooms.findOneAndDelete({ roomId: socket.data.roomId });
    }
} else {
    console.log("Room not found.");
}


});

});

  







// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));






const passport = require("passport");
const session = require("express-session");
const GoogleStrategy = require("passport-google-oauth20").Strategy;

// ✅ Ensure session middleware comes first
app.use(session({
    secret: process.env.SESSION_SECRET || "mysecretkey",
    resave: false,
    saveUninitialized: false
}));

// ✅ Ensure this middleware is after session
app.use(passport.initialize());
app.use(passport.session());

// ✅ Set user for EJS after passport.session()
app.use((req, res, next) => {
    res.locals.user = req.user || null;
    next();
});

// ✅ Use environment variables for security
passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: "/auth/google/callback"
}, async (accessToken, refreshToken, profile, done) => {
    try {
        let user = await googleUsers.findOne({ googleId: profile.id });

        if (!user) {
            user = new googleUsers({
                googleId: profile.id,
                name: profile.displayName,
                email: profile.emails[0].value,
                photoUrl: profile.photos[0].value,
                provider: profile.provider,
                subscription: "free"
            });
            await user.save();

            try {
                await sendHtmlEmail(`${user.email}`);
            } catch (error) {
                console.log("An error occurred", error);
            }
        }

        return done(null, user);
    } catch (error) {
        return done(error, null);
    }
}));

// ✅ Serialize & Deserialize User
passport.serializeUser((user, done) => {
    done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
    try {
        const user = await googleUsers.findById(id);
        done(null, user);
    } catch (error) {
        done(error, null);
    }
});












app.use('/', indexRouter);
app.use('/users', usersRouter);



// catch 404 and forward to error handler
app.use(function(req, res, next) {
  next(createError(404));
});

// error handler
app.use(function(err, req, res, next) {
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  res.status(err.status || 500);
  res.render('error');
});

module.exports = { app, server};
