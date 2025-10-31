const mongoose = require('mongoose');

const schoolMediaSchema = new mongoose.Schema({
    school: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'School',
        required: true
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    createdByName: {
        type: String,
        required: true
    },

    title: {
        type: String,
        required: true
    },
    description: {
        type: String,
        default: ''
    },
    type: {
        type: String,
        enum: ['video', 'reel'],
        default: 'video'
    },
    visibility: {
        type: String,
        enum: ['public', 'school-only'],
        default: 'school-only'
    },

    fileUrl: {
        type: String,
        required: true
    },
    fileKey: {
        type: String
    },
    mimeType: {
        type: String
    },

    tags: [String],
    eventDate: {
        type: String
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    },
});

schoolMediaSchema.index({ school: 1, createdAt: -1 });

module.exports = mongoose.model('SchoolMedia', schoolMediaSchema);
