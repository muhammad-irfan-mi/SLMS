const mongoose = require("mongoose");

const FeeDetailSchema = new mongoose.Schema(
  {
    studentId: {
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
    amount: { type: Number, required: true },
    title: { type: String, required: true },
    description: { type: String },
    voucherImage: { type: String },
    studentProofImage: { type: String },
    status: {
      type: String,
      enum: ["pending", "submitted", "approved", "rejected"],
      default: "pending",
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("FeeDetail", FeeDetailSchema);