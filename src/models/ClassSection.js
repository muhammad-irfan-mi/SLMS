const mongoose = require("mongoose");

const SectionSchema = new mongoose.Schema({
  name: { type: String, required: true },
});

const ClassSectionSchema = new mongoose.Schema(
  {
    school: { type: mongoose.Schema.Types.ObjectId, ref: "School", required: true },
    class: { type: String, required: true },
    order: { type: Number, default: 0, index: true },
    sections: [SectionSchema],
  },
  { timestamps: true }
);

ClassSectionSchema.index({ school: 1, class: 1 }, { unique: true });

module.exports = mongoose.model("ClassSection", ClassSectionSchema);
