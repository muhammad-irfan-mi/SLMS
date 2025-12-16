const SalarySlip = require("../models/SalarySlip");
const User = require("../models/User");
const { deleteFileFromS3, uploadFileToS3 } = require("../services/s3.service");

// Upload helper
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
            image: image,
            status: "approved",
            approvedAt: new Date(),
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

// ADMIN: AUTO DELETE OLD MONTH SLIPS + return current month status
// const getTeachersSalaryStatus = async (req, res) => {
//     try {
//         const schoolId = req.user.school;

//         const currentMonth = new Date().toISOString().slice(0, 7);
//         const slips = await SalarySlip.find({ school: schoolId });

//         let oldMonthFound = false;

//         slips.forEach((slip) => {
//             if (slip.month !== currentMonth) oldMonthFound = true;
//         });

//         if (oldMonthFound) {
//             for (let slip of slips) {
//                 if (slip.image) await deleteFileFromS3(slip.image);
//                 await SalarySlip.deleteOne({ _id: slip._id });
//             }
//             console.log("Auto-deleted old month salary slips");
//         }

//         // Fetch slips again for current month
//         const monthSlips = await SalarySlip.find({
//             school: schoolId,
//             month: currentMonth,
//         });

//         const slipMap = {};
//         monthSlips.forEach((s) => {
//             slipMap[s.teacherId.toString()] = s;
//         });

//         const teachers = await User.find({
//             school: schoolId,
//             role: "teacher",
//         }).select("_id name email");

//         const result = teachers.map((t) => {
//             const slip = slipMap[t._id.toString()];
//             return {
//                 teacherId: t._id,
//                 name: t.name,
//                 email: t.email,
//                 month: currentMonth,
//                 status: slip ? slip.status : "pending",
//                 slip,
//             };
//         });

//         return res.status(200).json({
//             total: result.length,
//             teachers: result,
//         });
//     } catch (err) {
//         console.error("Error getting teacher salary status:", err);
//         return res.status(500).json({ message: err.message });
//     }
// };

const getTeachersSalaryStatus = async (req, res) => {
    try {
        const schoolId = req.user.school;

        // Current timestamp
        const now = Date.now();

        // Get all salary slips
        const slips = await SalarySlip.find({ school: schoolId });

        let shouldDelete = false;

        // Check if any slip is older than 2 minutes
        slips.forEach((slip) => {
            const slipAgeMs = now - new Date(slip.createdAt).getTime();
            const twoMinMs = 2 * 60 * 1000;

            if (slipAgeMs > twoMinMs) {
                shouldDelete = true;
            }
        });

        // AUTO DELETE IF OLDER THAN 2 MIN
        if (shouldDelete) {
            for (let slip of slips) {
                if (slip.image) await deleteFileFromS3(slip.image);
                await SalarySlip.deleteOne({ _id: slip._id });
            }
            console.log("Auto-deleted slips older than 2 minutes");
        }

        // Re-fetch slips (after delete)
        const monthSlips = await SalarySlip.find({ school: schoolId });

        const slipMap = {};
        monthSlips.forEach((s) => {
            slipMap[s.teacherId.toString()] = s;
        });

        // Get all teachers
        const teachers = await User.find({
            school: schoolId,
            role: "teacher",
        }).select("_id name email salary");

        const result = teachers.map((t) => {
            const slip = slipMap[t._id.toString()];
            return {
                teacherId: t._id,
                name: t.name,
                email: t.email,
                salary: t.salary,
                status: slip ? slip.status : "pending",
                slip,
            };
        });

        return res.status(200).json({
            total: result.length,
            teachers: result,
        });
    } catch (err) {
        console.error("Error getting teacher salary status:", err);
        return res.status(500).json({ message: err.message });
    }
};


module.exports = {
    sendSalarySlip,
    approveSalarySlip,
    updateSalarySlip,
    deleteSalarySlip,
    getTeacherSlips,
    getTeachersSalaryStatus,
};
