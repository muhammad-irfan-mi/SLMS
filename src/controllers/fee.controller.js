const FeeDetail = require("../models/FeeDetail");
const User = require("../models/User");
const { deleteFileFromS3, uploadFileToS3 } = require("../services/s3.service");

// Reusable Upload helper
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

// Upload Voucher
const createFeeDetail = async (req, res) => {
    try {
        const { studentId, month, amount, title, description } = req.body;
        const schoolId = req.user.school;

        if (!studentId || !month || !amount || !title)
            return res.status(400).json({ message: "Missing required fields" });

        const student = await User.findOne({
            _id: studentId,
            role: "student",
            school: schoolId,
        });

        if (!student)
            return res.status(404).json({ message: "Student not found in your school" });

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

// Upload Payment Proof
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

// Approve or Reject Payment
const approvePayment = async (req, res) => {
    try {
        const feeId = req.params.id;
        const schoolId = req.user.school;
        const { status } = req.body;

        if (!["approved", "rejected"].includes(status))
            return res.status(400).json({ message: "Invalid status update" });

        const fee = await FeeDetail.findOne({ _id: feeId, school: schoolId });
        if (!fee) return res.status(404).json({ message: "Fee detail not found" });
        if (fee.status === "pending")
            return res.status(400).json({ message: "Only retrun proof can be approved or rejected" });

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

// Update Fee Detail
const updateFeeDetail = async (req, res) => {
    try {
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

// Delete Fee Record
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

// Get My Fee Records
const getMyFeeDetails = async (req, res) => {
    try {
        const studentId = req.user._id;

        const fees = await FeeDetail.find({ studentId }).sort({ createdAt: -1 });
        const student = await User.findById(studentId);

        res.status(200).json({
            total: fees.length,
            fees,
            name: student.name,
            email: student.email
        });
    } catch (err) {
        console.error("Error fetching student fees:", err);
        res.status(500).json({ message: err.message });
    }
};

module.exports = {
    createFeeDetail,
    uploadStudentProof,
    approvePayment,
    updateFeeDetail,
    deleteFeeDetail,
    getMyFeeDetails,
};
