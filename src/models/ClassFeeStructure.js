const mongoose = require("mongoose");

const ClassFeeStructureSchema = new mongoose.Schema(
  {
    school: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "School",
      required: true,
      index: true,
    },

    classId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ClassSection",
      required: true,
      index: true,
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

    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

ClassFeeStructureSchema.index(
  { school: 1, classId: 1, feeComponent: 1 },
  { unique: true }
);

module.exports = mongoose.model(
  "ClassFeeStructure",
  ClassFeeStructureSchema
);