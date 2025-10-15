// const mongoose = require('mongoose');
// const { Schema } = mongoose;

// const OtpSchema = new Schema({
//   email: { type: String, required: true },
//   code: { type: String, required: true },
//   type: { type: String, enum: ['school_register','employee_verify','student_verify'], required: true },
//   createdAt: { type: Date, default: Date.now },
//   expiresAt: { type: Date, required: true }
// });

// OtpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// module.exports = mongoose.model('OTP', OtpSchema);
























































// const School = require("../models/School");
// const { uploadFileToS3, deleteFileFromS3 } = require("../services/s3.service");

// const addSchoolBySuperAdmin = async (req, res) => {
//   try {
//     const { name, email, phone, address, cnic, lat, lon } = req.body;

//     if (!name || !email) {
//       return res.status(400).json({ message: "Name and Email are required" });
//     }

//     const existingSchool = await School.findOne({ email });
//     if (existingSchool) {
//       return res.status(400).json({ message: "A school with this email already exists" });
//     }

//     // Upload files manually to S3
//     let cnicFront = null, cnicBack = null, nocDoc = null;

//     if (req.files?.cnicFront?.[0]) {
//       const file = req.files.cnicFront[0];
//       cnicFront = await uploadFileToS3({
//         fileBuffer: file.buffer,
//         fileName: file.originalname,
//         mimeType: file.mimetype,
//       });
//     }

//     if (req.files?.cnicBack?.[0]) {
//       const file = req.files.cnicBack[0];
//       cnicBack = await uploadFileToS3({
//         fileBuffer: file.buffer,
//         fileName: file.originalname,
//         mimeType: file.mimetype,
//       });
//     }

//     if (req.files?.nocDoc?.[0]) {
//       const file = req.files.nocDoc[0];
//       nocDoc = await uploadFileToS3({
//         fileBuffer: file.buffer,
//         fileName: file.originalname,
//         mimeType: file.mimetype,
//       });
//     }

//     const schoolId = "SCH-" + Date.now().toString().slice(-6);

//     const newSchool = new School({
//       name,
//       email,
//       phone,
//       address,
//       cnic,
//       images: { cnicFront, cnicBack, nocDoc },
//       schoolId,
//       location: { lat, lon },
//       verified: false,
//     });

//     await newSchool.save();

//     return res.status(201).json({
//       message: "School added successfully. Ask school to set its password.",
//       school: {
//         id: newSchool._id,
//         name: newSchool.name,
//         email: newSchool.email,
//         schoolId: newSchool.schoolId,
//       },
//     });
//   } catch (err) {
//     console.error("Error adding school:", err);
//     return res.status(500).json({
//       message: "Server error while adding school",
//       error: err.message,
//     });
//   }
// };


// const deleteSchoolBySuperAdmin = async (req, res) => {
//   try {
//     const { id } = req.params;
//     const school = await School.findById(id);

//     if (!school) {
//       return res.status(404).json({ message: "School not found" });
//     }

//     const { cnicFront, cnicBack, nocDoc } = school.images || {};
//     const filesToDelete = [cnicFront, cnicBack, nocDoc].filter(Boolean);

//     for (const fileUrl of filesToDelete) {
//       await deleteFileFromS3(fileUrl);
//     }

//     await school.deleteOne();

//     return res.status(200).json({ message: "School and its files deleted successfully" });
//   } catch (err) {
//     console.error("Error deleting school:", err);
//     return res.status(500).json({
//       message: "Server error while deleting school",
//       error: err.message,
//     });
//   }
// };

// module.exports = { addSchoolBySuperAdmin, deleteSchoolBySuperAdmin };

// add school by admin
// router.post(
//     "/add-school",
//     protect,
//     isSuperAdmin,
//     upload.fields([
//         { name: "cnicFront", maxCount: 1 },
//         { name: "cnicBack", maxCount: 1 },
//         { name: "nocDoc", maxCount: 1 },
//     ]),
//     addSchoolBySuperAdmin
// );
// router.delete("/delete-school/:id", protect, isSuperAdmin, deleteSchoolBySuperAdmin);

// now I want make api for edit school in whhic user give some field like it can give school name or something maybe some field schoold do not dd so please getting field update remainin no need to change
// const mongoose = require("mongoose");
// const { Schema } = mongoose;

// const SchoolSchema = new Schema({
//   name: { type: String, required: true },
//   address: String,
//   email: { type: String, required: true, unique: true },
//   phone: String,
//   cnic: String,
//   password: String,
//   images: {
//     cnicFront: String,
//     cnicBack: String,
//     nocDoc: String,
//   },
//   schoolId: { type: String, required: true, unique: true },
//   verified: { type: Boolean, default: false },
//   location: {
//     lat: Number,
//     lon: Number,
//   },

//   otp: {
//     code: String,
//     expiresAt: Date,
//   },

//   createdAt: { type: Date, default: Date.now },
// });

// SchoolSchema.index({ createdAt: 1 }, { expireAfterSeconds: 24 * 60 * 60, partialFilterExpression: { verified: false } });

// module.exports = mongoose.model("School", SchoolSchema);
// add also no of student in school during creation or may be some time we need to update