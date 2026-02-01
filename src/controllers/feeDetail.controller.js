const BankAccount = require("../models/BankAccount");
const ClassSection = require("../models/ClassSection");
const FeeDetail = require("../models/FeeDetail");
const User = require("../models/User");
const { deleteFileFromS3, uploadFileToS3 } = require("../services/s3.service");
const {
  createFeeDetailSchema,
  updateFeeDetailSchema,
  approvePaymentSchema,
  getAllFeeDetailsSchema,
  getMyFeeDetailsSchema,
} = require("../validators/feeDetail.validation");

async function uploadImage(files, fieldName, existingImage = null) {
  let image = existingImage;

  if (files?.[fieldName]?.[0]) {
    if (image) await deleteFileFromS3(image);
    image = await uploadFileToS3({
      fileBuffer: files[fieldName][0].buffer,
      fileName: files[fieldName][0].originalname,
      mimeType: files[fieldName][0].mimetype,
    });
  }

  return image;
}

const getClassSectionInfo = async (classId, sectionId, schoolId) => {
  const classSection = await ClassSection.findOne({
    _id: classId,
    school: schoolId
  }).lean();

  if (!classSection) {
    return { class: null, section: null };
  }

  const classInfo = {
    _id: classSection._id,
    name: classSection.class
  };

  let sectionInfo = null;
  if (sectionId && classSection.sections) {
    const section = classSection.sections.find(
      sec => sec._id.toString() === sectionId.toString()
    );
    if (section) {
      sectionInfo = {
        _id: section._id,
        name: section.name
      };
    }
  }

  return { class: classInfo, section: sectionInfo };
};

const createFeeDetail = async (req, res) => {
  try {
    const { error } = createFeeDetailSchema.validate(req.body);
    if (error) return res.status(400).json({ message: error.details[0].message });

    const { studentId, month, amount, title, description } = req.body;
    const schoolId = req.user.school;

    const student = await User.findOne({
      _id: studentId,
      role: "student",
      school: schoolId,
    });

    if (!student) return res.status(404).json({ message: "Student not found in your school" });

    const voucherImage = await uploadImage(req.files, "voucherImage");

    const fee = new FeeDetail({
      studentId,
      school: schoolId,
      month,
      amount,
      title,
      description,
      voucherImage,
      status: "pending",
    });

    await fee.save();

    res.status(201).json({
      message: "Fee detail created successfully",
      fee,
    });
  } catch (err) {
    console.error("Error creating fee detail:", err);
    res.status(500).json({ message: err.message });
  }
};

const uploadStudentProof = async (req, res) => {
  try {
    const feeId = req.params.id;
    const studentId = req.user._id;

    const fee = await FeeDetail.findOne({ _id: feeId, studentId });
    if (!fee) return res.status(404).json({ message: "Fee record not found" });

    fee.studentProofImage = await uploadImage(
      req.files,
      "studentProofImage",
      fee.studentProofImage
    );

    fee.status = "submitted";
    await fee.save();

    res.status(200).json({
      message: "Payment proof submitted successfully",
      fee,
    });
  } catch (err) {
    console.error("Error uploading student proof:", err);
    res.status(500).json({ message: err.message });
  }
};

const approvePayment = async (req, res) => {
  try {
    const { error } = approvePaymentSchema.validate(req.body);
    if (error) return res.status(400).json({ message: error.details[0].message });

    const feeId = req.params.id;
    const schoolId = req.user.school;
    const { status } = req.body;

    const fee = await FeeDetail.findOne({ _id: feeId, school: schoolId });
    if (!fee) return res.status(404).json({ message: "Fee detail not found" });
    if (fee.status === "pending") return res.status(400).json({ message: "Only submitted proof can be approved or rejected" });

    fee.status = status;
    await fee.save();

    res.status(200).json({
      message: `Payment ${status}`,
      fee,
    });
  } catch (err) {
    console.error("Error approving payment:", err);
    res.status(500).json({ message: err.message });
  }
};

const updateFeeDetail = async (req, res) => {
  try {
    const { error } = updateFeeDetailSchema.validate(req.body);
    if (error) return res.status(400).json({ message: error.details[0].message });

    const feeId = req.params.id;
    const schoolId = req.user.school;

    const fee = await FeeDetail.findOne({ _id: feeId, school: schoolId });
    if (!fee) return res.status(404).json({ message: "Fee record not found" });

    const { month, amount, title, description } = req.body;

    if (month) fee.month = month;
    if (amount) fee.amount = amount;
    if (title) fee.title = title;
    if (description) fee.description = description;

    fee.voucherImage = await uploadImage(req.files, "voucherImage", fee.voucherImage);
    await fee.save();

    res.status(200).json({ message: "Fee detail updated", fee });
  } catch (err) {
    console.error("Error updating fee:", err);
    res.status(500).json({ message: err.message });
  }
};

const deleteFeeDetail = async (req, res) => {
  try {
    const feeId = req.params.id;
    const schoolId = req.user.school;

    const fee = await FeeDetail.findOne({ _id: feeId, school: schoolId });
    if (!fee) return res.status(404).json({ message: "Fee record not found" });

    if (fee.voucherImage) await deleteFileFromS3(fee.voucherImage);
    if (fee.studentProofImage) await deleteFileFromS3(fee.studentProofImage);

    await fee.deleteOne();

    res.status(200).json({ message: "Fee detail deleted successfully" });
  } catch (err) {
    console.error("Error deleting fee detail:", err);
    res.status(500).json({ message: err.message });
  }
};

const getAllFeeDetails = async (req, res) => {
  try {
    const { error, value } = getAllFeeDetailsSchema.validate(req.query);
    if (error) {
      return res.status(400).json({ message: error.details[0].message });
    }

    const schoolId = req.user.school;
    const { page, limit, studentId, month, status } = value;

    const filter = { school: schoolId };

    if (studentId) filter.studentId = studentId;
    if (month) filter.month = month;
    if (status) filter.status = status;

    const skip = (page - 1) * limit;

    const [fees, total] = await Promise.all([
      FeeDetail.find(filter)
        .populate("studentId", "name email rollNo school classInfo sectionInfo")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),

      FeeDetail.countDocuments(filter),
    ]);

    const formattedFees = await Promise.all(fees.map(async (fee) => {
      const feeObj = { ...fee };

      let schoolId = null;
      if (feeObj.studentId && feeObj.studentId.school) {
        schoolId = feeObj.studentId.school;
      }

      if (feeObj.studentId && feeObj.studentId.classInfo && feeObj.studentId.classInfo.id) {
        const classSectionInfo = await getClassSectionInfo(
          feeObj.studentId.classInfo.id,
          feeObj.studentId.sectionInfo ? feeObj.studentId.sectionInfo.id : null,
          schoolId
        );

        if (classSectionInfo.class) {
          feeObj.classInfo = {
            id: classSectionInfo.class._id,
            name: classSectionInfo.class.name
          };
        }

        if (classSectionInfo.section) {
          feeObj.sectionInfo = {
            id: classSectionInfo.section._id,
            name: classSectionInfo.section.name
          };
        }
      }

      if (feeObj.studentId) {
        feeObj.studentInfo = {
          _id: feeObj.studentId._id,
          name: feeObj.studentId.name,
          email: feeObj.studentId.email,
          rollNo: feeObj.studentId.rollNo,
          school: feeObj.studentId.school
        };
        delete feeObj.studentId;
      }

      return feeObj;
    }));

    return res.status(200).json({
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      fees: formattedFees,
    });
  } catch (err) {
    console.error("Error fetching all fee records:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

const getMyFeeDetails = async (req, res) => {
  try {
    const { error, value } = getMyFeeDetailsSchema.validate(req.query);
    if (error) {
      return res.status(400).json({ message: error.details[0].message });
    }

    const studentId = req.user._id;
    const { page, limit } = value;

    const skip = (page - 1) * limit;

    const student = await User.findById(studentId)
      .select("name email school classInfo sectionInfo")
      .lean();

    if (!student) {
      return res.status(404).json({ message: "Student not found" });
    }

    const [fees, total, bankAccounts] = await Promise.all([
      FeeDetail.find({ studentId })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),

      FeeDetail.countDocuments({ studentId }),

      BankAccount.find({
        school: student.school,
        isActive: true
      })
        .select('accountHolderName accountNumber bankName branchName accountType ifscCode')
        .sort({ createdAt: -1 })
        .lean()
    ]);

    return res.status(200).json({
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      student: {
        _id: student._id,
        name: student.name,
        email: student.email,
        classInfo: student.classInfo,
        sectionInfo: student.sectionInfo,
        fees,
        bankAccounts
      },
    });
  } catch (err) {
    return res.status(500).json({ message: "Server error" });
  }
};

module.exports = {
  createFeeDetail,
  uploadStudentProof,
  approvePayment,
  updateFeeDetail,
  deleteFeeDetail,
  getAllFeeDetails,
  getMyFeeDetails,
};