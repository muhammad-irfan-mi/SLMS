const mongoose = require("mongoose");

const SectionSchema = new mongoose.Schema({
  name: { type: String, required: true },
});

const ClassSectionSchema = new mongoose.Schema(
  {
    school: { type: mongoose.Schema.Types.ObjectId, ref: "School", required: true },
    class: { type: String, required: true },
    sections: [SectionSchema],
  },
  { timestamps: true }
);

module.exports = mongoose.model("ClassSection", ClassSectionSchema);
