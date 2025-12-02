const mongoose = require("mongoose");

const eventSchema = new mongoose.Schema({
    school: { type: mongoose.Schema.Types.ObjectId, ref: "School", required: true },

    title: { type: String, required: true },
    description: { type: String },

    eventDate: { type: Date, required: true },

    status: {
        type: String,
        enum: ["upcoming", "completed"],
        default: "upcoming"
    },

    images: [
        { type: String }
    ],

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },

}, { timestamps: true });

module.exports = mongoose.model("Event", eventSchema);