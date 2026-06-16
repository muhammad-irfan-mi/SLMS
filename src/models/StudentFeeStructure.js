const mongoose = require("mongoose");

const StudentFeeStructureSchema = new mongoose.Schema(
    {
        school: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "School",
            required: true,
            index: true,
        },

        studentId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Student",
            required: true,
            index: true,
        },

        classId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "ClassSection",
            required: true,
        },

        feeComponent: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "FeeComponent",
            required: true,
        },

        amount: {
            type: Number,
            min: 0,
            required: true,
        },

        type: {
            type: String,
            enum: ["override", "custom", "exempt"],
            default: "override",
        },

        isActive: {
            type: Boolean,
            default: true,
        },
    },
    { timestamps: true }
);

// prevent duplicate per student per component
StudentFeeStructureSchema.index(
    { school: 1, studentId: 1, feeComponent: 1 },
    { unique: true }
);

module.exports = mongoose.model(
    "StudentFeeStructure",
    StudentFeeStructureSchema
);