const mongoose = require("mongoose");

const AiYusahVideoSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    description: String,
    youtubeLink: { type: String, required: true },

    category: {
      type: String,
      enum: [
        "Behavioural Activities",
        "English Learning",
        "Health & Food",
        "Islamic Studies",
        "Capacity Building",
        "Sports",
        "Education",
        "AI Poems"
      ],
      required: true
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model("AiYusahVideo", AiYusahVideoSchema);
