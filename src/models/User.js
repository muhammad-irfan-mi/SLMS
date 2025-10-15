const mongoose = require("mongoose");
const { Schema } = mongoose;

const UserSchema = new Schema({
  email: { type: String, required: true },
  cnic: { type: String },
  name: { type: String, required: true },
  fatherName: String,
  phone: String,
  address: String,
  role: {
    type: String,
    enum: ["superadmin", "admin_office", "teacher", "student"],
    required: true,
  },
  school: {
    type: Schema.Types.ObjectId,
    ref: "School",
    required: function () {
      return this.role !== "superadmin";
    },
  },
  password: String,
  salary: Number,
  joiningDate: Date,
  subjectAssigned: [String],
  assignClass: { type: Schema.Types.ObjectId, ref: "Class" },
  assignSection: { type: Schema.Types.ObjectId, ref: "Section" },
  classInfo: {
    id: { type: mongoose.Schema.Types.ObjectId, ref: "Class" },
    name: String
  },
  sectionInfo: {
    id: { type: mongoose.Schema.Types.ObjectId, ref: "Section" },
    name: String
  },


  rollNo: String,
  images: {
    cnicFront: String,
    cnicBack: String,
    recentPic: String,
  },
  deviceLocation: {
    lat: Number,
    lng: Number,
  },
  otp: {
    code: String,
    expiresAt: Date,
  },
  verified: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
});

UserSchema.index(
  { createdAt: 1 },
  {
    expireAfterSeconds: 7 * 24 * 60 * 60,
    partialFilterExpression: { verified: false },
  }
);

module.exports = mongoose.model("User", UserSchema);
