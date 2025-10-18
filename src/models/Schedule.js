const mongoose = require("mongoose");

const scheduleSchema = new mongoose.Schema(
  {
    school: { type: mongoose.Schema.Types.ObjectId, ref: "School", required: true },
    classId: { type: mongoose.Schema.Types.ObjectId, ref: "ClassSection", required: true },
    sectionId: { type: mongoose.Schema.Types.ObjectId }, 
    subjectId: { type: mongoose.Schema.Types.ObjectId, ref: "Subject" },
    day: {
      type: String,
      enum: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],
      required: true,
    },
    type: { type: String, enum: ["subject", "break", "holiday"], required: true },
    startTime: { type: String, required: true },
    endTime: { type: String, required: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Schedule", scheduleSchema);
