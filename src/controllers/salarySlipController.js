const SalarySlip = require("../models/SalarySlip");
const User = require("../models/User");
const { deleteFileFromS3, uploadFileToS3 } = require("../services/s3.service");

async function uploadSlipImage(files, existingImage = null) {
    let image = existingImage;

    if (files?.slipImage?.[0]) {
        if (image) await deleteFileFromS3(image);

        image = await uploadFileToS3({
            fileBuffer: files.slipImage[0].buffer,
            fileName: files.slipImage[0].originalname,
            mimeType: files.slipImage[0].mimetype,
        });
    }

    return image;
}

// ADMIN: Send salary slip
const sendSalarySlip = async (req, res) => {
    try {
        const { teacherId, month, title, description, salary } = req.body;
        const schoolId = req.user.school;

        if (!teacherId || !month || !title || !salary)
            return res.status(400).json({ message: "Missing required fields" });

        const teacher = await User.findOne({
            _id: teacherId,
            role: "teacher",
            school: schoolId,
        });

        if (!teacher)
            return res.status(404).json({ message: "Teacher not found in your school" });

        const image = await uploadSlipImage(req.files);

        const slip = new SalarySlip({
            teacherId,
            school: schoolId,
            month,
            title,
            description,
            salary,
            image,
            status: "pending",
        });

        await slip.save();

        return res.status(201).json({
            message: "Salary slip sent successfully",
            slip,
        });
    } catch (err) {
        console.error("Error sending salary slip:", err);
        return res.status(500).json({ message: err.message || "Server error" });
    }
};

// TEACHER: Approve slip
const approveSalarySlip = async (req, res) => {
    try {
        const slipId = req.params.id;
        const teacherId = req.user._id;

        const slip = await SalarySlip.findOne({ _id: slipId, teacherId });
        if (!slip)
            return res.status(404).json({ message: "Slip not found" });

        slip.status = "approved";
        await slip.save();

        return res.status(200).json({
            message: "Slip approved successfully",
            slip,
        });
    } catch (err) {
        console.error("Error approving slip:", err);
        return res.status(500).json({ message: err.message });
    }
};

// ADMIN: Update salary slip
const updateSalarySlip = async (req, res) => {
    try {
        const slipId = req.params.id;
        const schoolId = req.user.school;

        const slip = await SalarySlip.findOne({ _id: slipId, school: schoolId });
        if (!slip)
            return res.status(404).json({ message: "Salary slip not found" });

        const { month, title, description, salary } = req.body;

        if (month) slip.month = month;
        if (title) slip.title = title;
        if (description) slip.description = description;
        if (salary) slip.salary = salary;

        slip.image = await uploadSlipImage(req.files, slip.image);

        await slip.save();

        return res.status(200).json({
            message: "Salary slip updated successfully",
            slip,
        });
    } catch (err) {
        console.error("Error updating slip:", err);
        return res.status(500).json({ message: err.message });
    }
};

// ADMIN: Delete slip
const deleteSalarySlip = async (req, res) => {
    try {
        const slipId = req.params.id;
        const schoolId = req.user.school;

        const slip = await SalarySlip.findOne({ _id: slipId, school: schoolId });
        if (!slip)
            return res.status(404).json({ message: "Slip not found" });

        if (slip.image) await deleteFileFromS3(slip.image);

        await slip.deleteOne();

        return res.status(200).json({ message: "Slip deleted successfully" });
    } catch (err) {
        console.error("Error deleting slip:", err);
        return res.status(500).json({ message: err.message });
    }
};

// TEACHER: Get all my slips
const getTeacherSlips = async (req, res) => {
    try {
        const teacherId = req.user._id;

        const slips = await SalarySlip.find({ teacherId })
            .sort({ createdAt: -1 })
            .lean();

        return res.status(200).json({
            total: slips.length,
            slips,
        });
    } catch (err) {
        console.error("Error getting slips:", err);
        return res.status(500).json({ message: err.message });
    }
};

module.exports = {
    sendSalarySlip,
    approveSalarySlip,
    updateSalarySlip,
    deleteSalarySlip,
    getTeacherSlips,
};
