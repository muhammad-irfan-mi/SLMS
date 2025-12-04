const mongoose = require("mongoose");

const AiYusahVideoSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    description: String,
    youtubeLink: { type: String, required: true },
    // school: { type: mongoose.Schema.Types.ObjectId, ref: "School", required: true },
    // uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model("AiYusahVideo", AiYusahVideoSchema);
