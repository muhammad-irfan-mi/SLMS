const mongoose = require("mongoose");

const FeeDetailSchema = new mongoose.Schema(
  {
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Student",
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
    dueDate: { type: Date, required: true },
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

FeeDetailSchema.index({ dueDate: 1, status: 1 });
FeeDetailSchema.index({ studentId: 1, dueDate: 1 });

module.exports = mongoose.model("FeeDetail", FeeDetailSchema);