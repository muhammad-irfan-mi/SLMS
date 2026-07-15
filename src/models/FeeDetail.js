const mongoose = require("mongoose");

const FeeDetailSchema = new mongoose.Schema(
  {
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
    month: {
      type: String,
      required: true,
      index: true
    },
    feeBreakdown: [
      {
        name: String,
        amount: Number,
        type: {
          type: String,
          enum: ["class", "student", "custom"]
        }
      }
    ],
    // subtotal: { type: Number, required: true },
    discountAmount: { type: Number, default: 0 },
    finalAmount: { type: Number, required: true },
    paidAmount: { type: Number, default: 0 },
    remainingAmount: { type: Number, required: true },
    voucherNumber: {
      type: String,
      index: true,
      trim: true
    },
    discountApplied: {
      type: {
        type: String,
        enum: ["percentage", "fixed", null]
      },
      value: Number,
      amount: Number
    },


    title: { type: String, required: true },
    description: { type: String },
    dueDate: { type: Date, required: true, index: true },
    voucherImage: { type: String },

    status: {
      type: String,
      enum: ["pending", "submitted", "partially_paid", "paid", "rejected"],
      default: "pending",
      index: true
    }
  },
  { timestamps: true }
);

// Essential indexes only
FeeDetailSchema.index({ studentId: 1, month: 1 });
FeeDetailSchema.index({ school: 1, status: 1, dueDate: 1 });
FeeDetailSchema.index({ remainingAmount: 1, dueDate: 1 });

module.exports = mongoose.model("FeeDetail", FeeDetailSchema);