const mongoose = require("mongoose");

const diarySchema = new mongoose.Schema({
    school: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "School", required: true
    },
    classId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "ClassSection", required: true
    },
    sectionId: {
        type: mongoose.Schema.Types.ObjectId,
        required: true
    },
    subjectId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Subject",
        required: true
    },

    date: {
        type: String,
        required: true
    },
    dueDate: {
        type: String,
        required: true
    },
    title: {
        type: String,
        required: true
    },
    description: {
        type: String
    },

    forAll: {
        type: Boolean,
        default: true
    },
    studentIds: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
    }],

    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    createdByName: {
        type: String,
        required: true
    },

    createdAt: {
        type: Date,
        default: Date.now
    },
});

module.exports = mongoose.model("Diary", diarySchema);
