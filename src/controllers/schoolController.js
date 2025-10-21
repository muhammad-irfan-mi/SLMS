const School = require("../models/School");
const { uploadFileToS3, deleteFileFromS3 } = require("../services/s3.service");

const addSchoolBySuperAdmin = async (req, res) => {
  try {
    const { name, email, phone, address, cnic, lat, lon, noOfStudents } = req.body;

    if (!name || !email) {
      return res.status(400).json({ message: "Name and Email are required" });
    }

    const existingSchool = await School.findOne({ email });
    if (existingSchool) {
      return res.status(400).json({ message: "A school with this email already exists" });
    }

    // Upload files manually to S3
    let cnicFront = null, cnicBack = null, nocDoc = null;

    if (req.files?.cnicFront?.[0]) {
      const file = req.files.cnicFront[0];
      cnicFront = await uploadFileToS3({
        fileBuffer: file.buffer,
        fileName: file.originalname,
        mimeType: file.mimetype,
      });
    }

    if (req.files?.cnicBack?.[0]) {
      const file = req.files.cnicBack[0];
      cnicBack = await uploadFileToS3({
        fileBuffer: file.buffer,
        fileName: file.originalname,
        mimeType: file.mimetype,
      });
    }

    if (req.files?.nocDoc?.[0]) {
      const file = req.files.nocDoc[0];
      nocDoc = await uploadFileToS3({
        fileBuffer: file.buffer,
        fileName: file.originalname,
        mimeType: file.mimetype,
      });
    }

    const schoolId = "SCH-" + Date.now().toString().slice(-6);

    const newSchool = new School({
      name,
      email,
      phone,
      address,
      cnic,
      images: { cnicFront, cnicBack, nocDoc },
      schoolId,
      location: { lat, lon },
      noOfStudents: noOfStudents || 0,
      verified: false,
    });

    await newSchool.save();

    return res.status(201).json({
      message: "School added successfully. Ask school to set its password.",
      school: {
        id: newSchool._id,
        name: newSchool.name,
        email: newSchool.email,
        schoolId: newSchool.schoolId,
      },
    });
  } catch (err) {
    console.error("Error adding school:", err);
    return res.status(500).json({
      message: "Server error while adding school",
      error: err.message,
    });
  }
};

const editSchoolBySuperAdmin = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const school = await School.findById(id);
    if (!school) {
      return res.status(404).json({ message: "School not found" });
    }

    if (req.files?.cnicFront?.[0]) {
      if (school.images.cnicFront) await deleteFileFromS3(school.images.cnicFront);
      const file = req.files.cnicFront[0];
      const uploaded = await uploadFileToS3({
        fileBuffer: file.buffer,
        fileName: file.originalname,
        mimeType: file.mimetype,
      });
      school.images.cnicFront = uploaded;
    }

    if (req.files?.cnicBack?.[0]) {
      if (school.images.cnicBack) await deleteFileFromS3(school.images.cnicBack);
      const file = req.files.cnicBack[0];
      const uploaded = await uploadFileToS3({
        fileBuffer: file.buffer,
        fileName: file.originalname,
        mimeType: file.mimetype,
      });
      school.images.cnicBack = uploaded;
    }

    if (req.files?.nocDoc?.[0]) {
      if (school.images.nocDoc) await deleteFileFromS3(school.images.nocDoc);
      const file = req.files.nocDoc[0];
      const uploaded = await uploadFileToS3({
        fileBuffer: file.buffer,
        fileName: file.originalname,
        mimeType: file.mimetype,
      });
      school.images.nocDoc = uploaded;
    }

    const fields = [
      "name",
      "email",
      "phone",
      "address",
      "cnic",
      "noOfStudents",
      "verified",
      "location.lat",
      "location.lon",
    ];

    fields.forEach((field) => {
      const keys = field.split(".");
      if (keys.length === 1 && updates[keys[0]] !== undefined) {
        school[keys[0]] = updates[keys[0]];
      } else if (keys.length === 2 && updates[keys[0]]?.[keys[1]] !== undefined) {
        school[keys[0]][keys[1]] = updates[keys[0]][keys[1]];
      }
    });

    await school.save();

    return res.status(200).json({
      message: "School updated successfully",
      school,
    });
  } catch (err) {
    console.error("Error updating school:", err);
    return res.status(500).json({
      message: "Server error while updating school",
      error: err.message,
    });
  }
};

const deleteSchoolBySuperAdmin = async (req, res) => {
  try {
    const { id } = req.params;
    const school = await School.findById(id);

    if (!school) {
      return res.status(404).json({ message: "School not found" });
    }

    const { cnicFront, cnicBack, nocDoc } = school.images || {};
    const filesToDelete = [cnicFront, cnicBack, nocDoc].filter(Boolean);

    for (const fileUrl of filesToDelete) {
      await deleteFileFromS3(fileUrl);
    }

    await school.deleteOne();

    return res.status(200).json({ message: "School and its files deleted successfully" });
  } catch (err) {
    console.error("Error deleting school:", err);
    return res.status(500).json({
      message: "Server error while deleting school",
      error: err.message,
    });
  }
};

// ✅ Get all schools (Super Admin only)
const getAllSchools = async (req, res) => {
  try {
    const schools = await School.find().select("-password -otp"); // Hide sensitive fields
    return res.status(200).json({
      message: "All schools fetched successfully",
      count: schools.length,
      schools,
    });
  } catch (err) {
    console.error("Error fetching schools:", err);
    return res.status(500).json({
      message: "Server error while fetching schools",
      error: err.message,
    });
  }
};

// ✅ Get single school by ID
const getSchoolById = async (req, res) => {
  try {
    const { id } = req.params;
    const school = await School.findById(id).select("-password -otp");

    if (!school) {
      return res.status(404).json({ message: "School not found" });
    }

    return res.status(200).json({
      message: "School fetched successfully",
      school,
    });
  } catch (err) {
    console.error("Error fetching school:", err);
    return res.status(500).json({
      message: "Server error while fetching school",
      error: err.message,
    });
  }
};



module.exports = {
  addSchoolBySuperAdmin,
  deleteSchoolBySuperAdmin,
  editSchoolBySuperAdmin,
  getAllSchools,
  getSchoolById
};
