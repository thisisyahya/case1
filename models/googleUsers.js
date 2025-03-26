const mongoose = require("mongoose");

const googleUserSchema = new mongoose.Schema({
    googleId: { type: String, required: true, unique: true },  // Google User ID
    name: { type: String, required: true },                    // User's full name
    photoUrl: { type: String, required: true },    
    email:{type:String, required:true},         
    provider: { type: String, default: "google" },            // OAuth provider (default: Google)
    createdAt: { type: Date, default: Date.now },             // Date of account creation
    subscription: { type: String, default: "free" }           // Subscription type (e.g., "free", "premium")
});

const googleUsers = mongoose.model("googleusers", googleUserSchema);

module.exports = googleUsers;