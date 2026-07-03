const mongoose = require("mongoose");

const FeePaymentSchema = new mongoose.Schema(
  {
    feeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "FeeDetail",
      required: true,
      index: true
    },
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Student",
      required: true,
      index: true
    },
    school: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "School",
      required: true,
      index: true
    },
    amount: { type: Number, required: true },
    paymentMethod: {
      type: String,
      enum: ["cash", "bank", null],
      default: null
    },
    bankAccountId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "BankAccount",
      default: null
    },
    proofImage: { type: String },
    transactionId: { type: String },
    status: {
      type: String,
      enum: ["submitted", "approved", "rejected"],
      default: "submitted",
      index: true
    },
    remarks: { type: String },
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Staff",
      default: null
    },
    approvedAt: { type: Date }
  },
  { timestamps: true }
);

FeePaymentSchema.index({ feeId: 1, status: 1 });
FeePaymentSchema.index({ school: 1, status: 1, createdAt: -1 });
FeePaymentSchema.index({ bankAccountId: 1 });


module.exports = mongoose.model("FeePayment", FeePaymentSchema);