const mongoose = require("mongoose");

const SliderImageSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    caption: { type: String },
    link: { type: String },
    order: { type: Number, default: 0 },
    active: { type: Boolean, default: true },

    image: { type: String, required: true },

    category: {
      type: String,
      required: true,
      enum: ["global", "event", "notice", "general"], 
    },

    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    school: { type: mongoose.Schema.Types.ObjectId, ref: "School", default: null },

    uploadedByRole: {
      type: String,
      enum: ["superadmin", "admin_office", "school"],
      required: true
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("SliderImage", SliderImageSchema);
