const mongoose = require("mongoose");

const SalarySlipSchema = new mongoose.Schema(
    {
        teacherId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        school: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "School",
            required: true,
        },
        month: { type: String, required: true }, 
        title: { type: String, required: true },
        description: { type: String },
        salary: { type: Number, required: true },

        image: { type: String },
        status: {
            type: String,
            enum: ["pending", "approved"],
            default: "pending",
        },
    },
    { timestamps: true }
);

module.exports = mongoose.model("SalarySlip", SalarySlipSchema);
