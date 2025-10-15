const User = require("../models/User");
const School = require("../models/School");
const { uploadFileToS3, deleteFileFromS3 } = require("../services/s3.service");

// Helper for S3 uploads
async function uploadFiles(files, existingImages = {}) {
    const images = { ...existingImages };

    for (const key of ["cnicFront", "cnicBack", "recentPic"]) {
        if (files?.[key]?.[0]) {
            if (images[key]) await deleteFileFromS3(images[key]);
            images[key] = await uploadFileToS3({
                fileBuffer: files[key][0].buffer,
                fileName: files[key][0].originalname,
                mimeType: files[key][0].mimetype,
            });
        }
    }
    return images;
}

// ADD EMPLOYEE (Teacher / Admin Office)
const addEmployeeBySchool = async (req, res) => {
    try {
        const { name, email, phone, address, cnic, role, salary, joiningDate, subjectAssigned, assignClass, assignSection } = req.body;

        if (!name || !email || !role)
            return res.status(400).json({ message: "Name, email, and role are required" });

        if (!["teacher", "admin_office"].includes(role))
            return res.status(400).json({ message: "Invalid role for employee" });

        const schoolId = req.user.school;
        const existing = await User.findOne({ email });
        if (existing) return res.status(400).json({ message: "User with this email already exists" });

        const images = await uploadFiles(req.files);

        const newUser = new User({
            name,
            email,
            phone,
            address,
            cnic,
            role,
            salary: role === "teacher" ? salary : salary || null,
            joiningDate,
            subjectAssigned: role === "teacher" && subjectAssigned ? subjectAssigned.split(",") : [],
            assignClass: role === "teacher" ? assignClass : null,
            assignSection: role === "teacher" ? assignSection : null,
            school: schoolId,
            images,
        });

        await newUser.save();
        return res.status(201).json({ message: "Employee added successfully", user: newUser });
    } catch (err) {
        console.error("Error adding employee:", err);
        return res.status(500).json({ message: "Server error while adding employee", error: err.message });
    }
};

// UPDATE EMPLOYEE (Teacher/Admin Office)
const editEmployeeBySchool = async (req, res) => {
    try {
        const { id } = req.params;
        const existing = await User.findById(id);
        if (!existing || !["teacher", "admin_office"].includes(existing.role))
            return res.status(404).json({ message: "Employee not found" });

        if (existing.school.toString() !== req.user.school.toString())
            return res.status(403).json({ message: "Unauthorized" });

        const images = await uploadFiles(req.files, existing.images);

        const fieldsToUpdate = {
            name: req.body.name ?? existing.name,
            email: req.body.email ?? existing.email,
            phone: req.body.phone ?? existing.phone,
            address: req.body.address ?? existing.address,
            cnic: req.body.cnic ?? existing.cnic,
            salary: req.body.salary ?? existing.salary,
            joiningDate: req.body.joiningDate ?? existing.joiningDate,
            images,
        };

        if (existing.role === "teacher") {
            fieldsToUpdate.subjectAssigned = req.body.subjectAssigned
                ? req.body.subjectAssigned.split(",")
                : existing.subjectAssigned;
            fieldsToUpdate.assignClass = req.body.assignClass ?? existing.assignClass;
            fieldsToUpdate.assignSection = req.body.assignSection ?? existing.assignSection;
        }

        const updated = await User.findByIdAndUpdate(id, fieldsToUpdate, { new: true });
        return res.status(200).json({ message: "Employee updated successfully", user: updated });
    } catch (err) {
        console.error("Error updating employee:", err);
        return res.status(500).json({ message: "Server error while updating employee", error: err.message });
    }
};

// DELETE EMPLOYEE
const deleteEmployeeBySchool = async (req, res) => {
    try {
        const { id } = req.params;
        const user = await User.findById(id);

        if (!user || !["teacher", "admin_office"].includes(user.role))
            return res.status(404).json({ message: "Employee not found" });

        if (user.school.toString() !== req.user.school.toString())
            return res.status(403).json({ message: "Unauthorized" });

        const { cnicFront, cnicBack, recentPic } = user.images || {};
        for (const fileUrl of [cnicFront, cnicBack, recentPic].filter(Boolean))
            await deleteFileFromS3(fileUrl);

        await user.deleteOne();
        return res.status(200).json({ message: "Employee deleted successfully" });
    } catch (err) {
        console.error("Error deleting employee:", err);
        return res.status(500).json({ message: "Server error while deleting employee", error: err.message });
    }
};

// -------------------- STUDENTS --------------------

// ADD STUDENT
const addStudentBySchool = async (req, res) => {
    try {
        const { name, email, phone, address, cnic, fatherName, class: className, section, rollNo } = req.body;

        if (!name || !email)
            return res.status(400).json({ message: "Name and email are required" });

        const schoolId = req.user.school;
        const existing = await User.findOne({ email });
        if (existing) return res.status(400).json({ message: "Student with this email already exists" });

        const images = await uploadFiles(req.files);

        const newStudent = new User({
            name,
            email,
            phone,
            address,
            cnic,
            fatherName,
            role: "student",
            class: className,
            section,
            rollNo,
            school: schoolId,
            images,
        });

        await newStudent.save();
        await School.findByIdAndUpdate(schoolId, { $inc: { noOfStudents: 1 } });

        return res.status(201).json({ message: "Student added successfully", student: newStudent });
    } catch (err) {
        console.error("Error adding student:", err);
        return res.status(500).json({ message: "Server error while adding student", error: err.message });
    }
};

// UPDATE STUDENT
const editStudentBySchool = async (req, res) => {
    try {
        const { id } = req.params;
        const existing = await User.findById(id);

        if (!existing || existing.role !== "student")
            return res.status(404).json({ message: "Student not found" });

        if (existing.school.toString() !== req.user.school.toString())
            return res.status(403).json({ message: "Unauthorized" });

        const images = await uploadFiles(req.files, existing.images);

        const updatedData = {
            name: req.body.name ?? existing.name,
            email: req.body.email ?? existing.email,
            phone: req.body.phone ?? existing.phone,
            address: req.body.address ?? existing.address,
            cnic: req.body.cnic ?? existing.cnic,
            fatherName: req.body.fatherName ?? existing.fatherName,
            class: req.body.class ?? existing.class,
            section: req.body.section ?? existing.section,
            rollNo: req.body.rollNo ?? existing.rollNo,
            images,
        };

        const updated = await User.findByIdAndUpdate(id, updatedData, { new: true });
        return res.status(200).json({ message: "Student updated successfully", student: updated });
    } catch (err) {
        console.error("Error updating student:", err);
        return res.status(500).json({ message: "Server error while updating student", error: err.message });
    }
};

// DELETE STUDENT
const deleteStudentBySchool = async (req, res) => {
    try {
        const { id } = req.params;
        const student = await User.findById(id);

        if (!student || student.role !== "student")
            return res.status(404).json({ message: "Student not found" });

        if (student.school.toString() !== req.user.school.toString())
            return res.status(403).json({ message: "Unauthorized" });

        const { cnicFront, cnicBack, recentPic } = student.images || {};
        for (const fileUrl of [cnicFront, cnicBack, recentPic].filter(Boolean))
            await deleteFileFromS3(fileUrl);

        await student.deleteOne();
        await School.findByIdAndUpdate(req.user.school, { $inc: { noOfStudents: -1 } });

        return res.status(200).json({ message: "Student deleted successfully" });
    } catch (err) {
        console.error("Error deleting student:", err);
        return res.status(500).json({ message: "Server error while deleting student", error: err.message });
    }
};

module.exports = {
    addEmployeeBySchool,
    editEmployeeBySchool,
    deleteEmployeeBySchool,
    addStudentBySchool,
    editStudentBySchool,
    deleteStudentBySchool,
};
