const mongoose = require("mongoose");

const roomsSchema = new mongoose.Schema({
    roomId: { type: String, required: true, unique: true }, // Unique Room ID
    game: { type: String, required: true }, // Game Type
    maxPlayers: { type: Number, required: true }, // Maximum Players Allowed
    status: { type: Boolean, default: false }, // Corrected 'Boolean' type
    hasCase :{ type: Boolean, default: false },
    players: [
        {
            name: { type: String, required: true },                   
            photoUrl: { type: String, required: true }, 
            playerSocket: { type: String, required: true },
            playerAnswer: { type: String, default: "" }

        }
    ],
    identifiers: { type: [String], default: [], required:true},  // ✅ Defined type properly
    playerSockets: { type: [String], default: [], required:true }, // ✅ Defined type properly

    case:{type : String},
    options:{type:[String]},
    answer: {type:String}
});



const rooms = mongoose.model("rooms", roomsSchema);
module.exports = rooms;
