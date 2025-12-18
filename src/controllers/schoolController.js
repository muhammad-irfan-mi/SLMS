const School = require("../models/School");
const { uploadFileToS3, deleteFileFromS3 } = require("../services/s3.service");
const { validateEmail, validatePhone, validateSchoolName } = require("../validators/common.validation");
const { validateSchoolNameUniqueness } = require("../validators/school.validator");

const addSchoolBySuperAdmin = async (req, res) => {
  try {
    const { name, email, phone, address, cnic, lat, lon, noOfStudents } = req.body;

    const nameError = await validateSchoolNameUniqueness(name);
    if (nameError) { return res.status(400).json({ message: nameError }); }

    const emailError = validateEmail(email);
    if (emailError) return res.status(400).json({ message: emailError });

    const phoneError = validatePhone(phone);
    if (phoneError) return res.status(400).json({ message: phoneError });


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

    if (updates.name && updates.name !== school.name) {
      const nameError = await validateSchoolNameUniqueness(
        updates.name.trim(),
        id
      );
      if (nameError)
        return res.status(400).json({ message: nameError });

      school.name = updates.name.trim();
    }

    if (updates.email && updates.email !== school.email) {
      const emailError = await validateEmail(updates.email, id);
      if (emailError)
        return res.status(400).json({ message: emailError });

      school.email = updates.email.trim().toLowerCase();
    }

    if (updates.phone) {
      const phoneError = validatePhone(updates.phone);
      if (phoneError)
        return res.status(400).json({ message: phoneError });

      school.phone = updates.phone;
    }

    /* ================= OTHER FIELDS ================= */
    if (updates.address !== undefined) school.address = updates.address;
    if (updates.cnic !== undefined) school.cnic = updates.cnic;
    if (updates.noOfStudents !== undefined)
      school.noOfStudents = updates.noOfStudents;
    if (updates.verified !== undefined) school.verified = updates.verified;

    if (updates.location?.lat !== undefined)
      school.location.lat = updates.location.lat;
    if (updates.location?.lon !== undefined)
      school.location.lon = updates.location.lon;

    await school.save();

    return res.status(200).json({
      message: "School updated successfully",
      school,
    });
  } catch (err) {
    console.error("Error updating school:", err);
    return res.status(500).json({
      message: "Server error while updating school",
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

// Get all schools (Super Admin only)
const getAllSchools = async (req, res) => {
  try {
    let { page = 1, limit = 20 } = req.query;

    page = parseInt(page);
    limit = parseInt(limit);
    const skip = (page - 1) * limit;

    const total = await School.countDocuments();

    const schools = await School.find()
      .select("-password -otp")
      .skip(skip)
      .limit(limit);

    return res.status(200).json({
      message: "All schools fetched successfully",
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
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


// Get single school by ID
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
