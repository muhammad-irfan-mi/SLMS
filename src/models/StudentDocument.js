const mongoose = require("mongoose");

const StudentDocumentSchema = new mongoose.Schema(
    {
        studentId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        classId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "ClassSection",
            required: true,
        },
        sectionId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "ClassSection",
            required: true,
        },
        text: { type: String },
        files: [{ type: String }],
        uploadedFor: {
            type: String,
            enum: ["teacher", "admin_office"],
            default: "admin_office",
        },
    },
    { timestamps: true }
);

module.exports = mongoose.model("StudentDocument", StudentDocumentSchema);
