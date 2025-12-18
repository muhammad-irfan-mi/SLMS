const User = require("../models/User");
const School = require("../models/School");
const ClassSection = require("../models/ClassSection");
const { uploadFileToS3, deleteFileFromS3 } = require("../services/s3.service");
const { validateName, validateEmail, validatePhone, validatePassword } = require("../validators/common.validation");

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

// Helper: Auto-fill Class and Section from IDs
async function getClassAndSection(classId, sectionId) {
    if (!classId) return { classInfo: null, sectionInfo: null };

    const classDoc = await ClassSection.findById(classId);
    if (!classDoc) return { error: "Invalid class ID" };

    const classInfo = { id: classDoc._id, name: classDoc.class };
    let sectionInfo = null;

    if (sectionId) {
        const sectionObj = classDoc.sections.find(
            (sec) => sec._id.toString() === sectionId
        );
        if (!sectionObj) return { error: "Invalid section ID for this class" };

        sectionInfo = { id: sectionObj._id, name: sectionObj.name };
    }

    return { classInfo, sectionInfo };
}

// ADD EMPLOYEE (Teacher / Admin Office)
const addEmployeeBySchool = async (req, res) => {
    try {
        const {
            name,
            email,
            phone,
            address,
            cnic,
            role,
            salary,
            joiningDate,
            isIncharge,
            classId,
            sectionId,
        } = req.body;

        if (validateName(name))
            return res.status(400).json({ message: validateName(name) });

        if (validateEmail(email))
            return res.status(400).json({ message: validateEmail(email) });

        if (!role)
            return res.status(400).json({ message: "Name, email, and role are required" });

        if (!["teacher", "admin_office"].includes(role))
            return res.status(400).json({ message: "Invalid role for employee" });

        const schoolId = req.user.school;
        const existing = await User.findOne({ email });
        if (existing)
            return res.status(400).json({ message: "User with this email already exists" });

        const images = await uploadFiles(req.files);

        let classInfo = null;
        let sectionInfo = null;

        if (role === "teacher" && isIncharge === "true" && classId) {
            ({ classInfo, sectionInfo } = await getClassAndSection(classId, sectionId));
        }

        // Ensure teacher always has isIncharge set (default false)
        const inchargeFlag =
            role === "teacher" ? isIncharge === "true" : undefined;

        const newUser = new User({
            name,
            email,
            phone,
            address,
            cnic,
            role,
            salary: role === "teacher" ? salary : salary || null,
            joiningDate,
            isIncharge: inchargeFlag ?? false,
            classInfo,
            sectionInfo,
            school: schoolId,
            images,
        });

        await newUser.save();
        return res.status(201).json({ message: "Employee added successfully", user: newUser });
    } catch (err) {
        console.error("Error adding employee:", err);
        return res.status(500).json({ message: err.message || "Server error while adding employee" });
    }
};

// UPDATE EMPLOYEE
const editEmployeeBySchool = async (req, res) => {
    try {
        const { id } = req.params;
        const existing = await User.findById(id);
        if (!existing || !["teacher", "admin_office"].includes(existing.role))
            return res.status(404).json({ message: "Employee not found" });

        if (existing.school.toString() !== req.user.school.toString())
            return res.status(403).json({ message: "Unauthorized" });

        if (req.body.name && req.body.name !== existing.name) {
            const err = validateName(req.body.name);
            if (err) return res.status(400).json({ message: err });
        }

        if (req.body.phone) {
            const err = validatePhone(req.body.phone);
            if (err) return res.status(400).json({ message: err });
        }

        // if (req.body.email && req.body.email !== existing.email) {
        //     const err = validateEmail(req.body.email);
        //     if (err) return res.status(400).json({ message: err });
        // }

        if (req.body.password) {
            const err = validatePassword(req.body.password);
            if (err) return res.status(400).json({ message: err });

            req.body.password = await bcrypt.hash(req.body.password, 10);
        }

        const images = await uploadFiles(req.files, existing.images);

        let classInfo = existing.classInfo;
        let sectionInfo = existing.sectionInfo;

        // Auto-update class/section only if teacher and marked as incharge
        if (existing.role === "teacher" && req.body.isIncharge === "true" && req.body.classId) {
            ({ classInfo, sectionInfo } = await getClassAndSection(req.body.classId, req.body.sectionId));
        }

        const inchargeFlag =
            existing.role === "teacher"
                ? req.body.isIncharge
                    ? req.body.isIncharge === "true"
                    : existing.isIncharge
                : existing.isIncharge;

        const updatedFields = {
            name: req.body.name ?? existing.name,
            email: req.body.email ?? existing.email,
            phone: req.body.phone ?? existing.phone,
            address: req.body.address ?? existing.address,
            cnic: req.body.cnic ?? existing.cnic,
            salary: req.body.salary ?? existing.salary,
            joiningDate: req.body.joiningDate ?? existing.joiningDate,
            isIncharge: inchargeFlag,
            classInfo,
            sectionInfo,
            images,
        };

        const updated = await User.findByIdAndUpdate(id, updatedFields, { new: true });
        return res.status(200).json({ message: "Employee updated successfully", user: updated });
    } catch (err) {
        console.error("Error updating employee:", err);
        return res.status(500).json({ message: err.message || "Server error while updating employee" });
    }
};


// GET ALL EMPLOYEES (Teacher / Admin Office)
const getAllEmployeesBySchool = async (req, res) => {
    try {
        const schoolId = req.user.school;
        const employees = await User.find({
            school: schoolId,
            role: { $in: ["teacher", "admin_office"] },
        }).select("-password");
        return res.status(200).json({ employees });
    } catch (err) {
        console.error("Error fetching employees:", err);
        return res.status(500).json({ message: err.message || "Server error while fetching employees" });
    }
};

// GET EMPLOYEE BY ID
const getEmployeeById = async (req, res) => {
    try {
        const { id } = req.params;
        const employee = await User.findById(id).select("-password");
        if (!employee || !["teacher", "admin_office"].includes(employee.role))
            return res.status(404).json({ message: "Employee not found" });

        if (employee.school.toString() !== req.user.school.toString())
            return res.status(403).json({ message: "Unauthorized" });

        return res.status(200).json({ employee });
    } catch (err) {
        console.error("Error fetching employee:", err);
        return res.status(500).json({ message: err.message || "Server error while fetching employee" });
    }
};

// DELETE EMPLOYEE
const deleteEmployeeBySchool = async (req, res) => {
    try {
        const { id } = req.params;
        const employee = await User.findById(id);
        if (!employee || !["teacher", "admin_office"].includes(employee.role))
            return res.status(404).json({ message: "Employee not found" });

        if (employee.school.toString() !== req.user.school.toString())
            return res.status(403).json({ message: "Unauthorized" });

        const { cnicFront, cnicBack, recentPic } = employee.images || {};
        for (const fileUrl of [cnicFront, cnicBack, recentPic].filter(Boolean))
            await deleteFileFromS3(fileUrl);

        await employee.deleteOne();
        return res.status(200).json({ message: "Employee deleted successfully" });
    } catch (err) {
        console.error("Error deleting employee:", err);
        return res.status(500).json({ message: err.message || "Server error while deleting employee" });
    }
};

// ADD STUDENT
const addStudentBySchool = async (req, res) => {
    try {
        const { name, email, phone, address, cnic, fatherName, classId, sectionId, rollNo } = req.body;

        if (validateName(name))
            return res.status(400).json({ message: validateName(name) });

        if (validateEmail(email))
            return res.status(400).json({ message: validateEmail(email) });

        const schoolId = req.user.school;
        const existing = await User.findOne({ email });
        if (existing)
            return res.status(400).json({ message: "Student with this email already exists" });

        const result = await getClassAndSection(classId, sectionId);

        if (result.error) {
            return res.status(400).json({ message: result.error });
        }
        const { classInfo, sectionInfo } = result;

        const images = await uploadFiles(req.files);

        const newStudent = new User({
            name,
            email,
            phone,
            address,
            cnic,
            fatherName,
            role: "student",
            rollNo,
            classInfo,
            sectionInfo,
            school: schoolId,
            images,
        });

        await newStudent.save();
        await School.findByIdAndUpdate(schoolId, { $inc: { noOfStudents: 1 } });

        return res.status(201).json({ message: "Student added successfully", student: newStudent });
    } catch (err) {
        console.error("Error adding student:", err);
        return res.status(500).json({ message: err.message || "Server error while adding student" });
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

        if (req.body.name && req.body.name !== existing.name) {
            const err = validateName(req.body.name);
            if (err) return res.status(400).json({ message: err });
        }

        if (req.body.phone) {
            const err = validatePhone(req.body.phone);
            if (err) return res.status(400).json({ message: err });
        }

        // if (req.body.email && req.body.email !== existing.email) {
        //     const err = validateEmail(req.body.email);
        //     if (err) return res.status(400).json({ message: err });
        // }

        if (req.body.password) {
            const err = validatePassword(req.body.password);
            if (err) return res.status(400).json({ message: err });

            req.body.password = await bcrypt.hash(req.body.password, 10);
        }

        const images = await uploadFiles(req.files, existing.images);
        let classInfo = existing.classInfo;
        let sectionInfo = existing.sectionInfo;

        if (req.body.classId) {
            ({ classInfo, sectionInfo } = await getClassAndSection(req.body.classId, req.body.sectionId));
        }

        const updatedData = {
            name: req.body.name ?? existing.name,
            email: req.body.email ?? existing.email,
            phone: req.body.phone ?? existing.phone,
            address: req.body.address ?? existing.address,
            cnic: req.body.cnic ?? existing.cnic,
            fatherName: req.body.fatherName ?? existing.fatherName,
            rollNo: req.body.rollNo ?? existing.rollNo,
            classInfo,
            sectionInfo,
            images,
        };

        const updated = await User.findByIdAndUpdate(id, updatedData, { new: true });
        return res.status(200).json({ message: "Student updated successfully", student: updated });
    } catch (err) {
        console.error("Error updating student:", err);
        return res.status(500).json({ message: err.message || "Server error while updating student" });
    }
};

// GET ALL STUDENTS
const getAllStudentsBySchool = async (req, res) => {
    try {
        const schoolId = req.user.school;
        const students = await User.find({
            school: schoolId,
            role: "student",
        }).select("-password");
        return res.status(200).json({ students });
    } catch (err) {
        console.error("Error fetching students:", err);
        return res.status(500).json({ message: err.message || "Server error while fetching students" });
    }
};

const getStudentsBySection = async (req, res) => {
    try {
        const schoolId = req.user.school;
        const { sectionId } = req.params;

        if (!sectionId) {
            return res.status(400).json({ message: "sectionId is required" });
        }

        const students = await User.find({
            school: schoolId,
            role: "student",
            "sectionInfo.id": sectionId,
        }).select("-password");

        if (!students.length) {
            return res.status(404).json({ message: "No students found in this section" });
        }

        return res.status(200).json({
            total: students.length,
            students,
        });
    } catch (err) {
        console.error("Error fetching students by section:", err);
        return res.status(500).json({
            message: err.message || "Server error while fetching students by section",
        });
    }
};

// GET STUDENT BY ID
const getStudentById = async (req, res) => {
    try {
        const { id } = req.params;
        const student = await User.findById(id).select("-password");
        if (!student || student.role !== "student")
            return res.status(404).json({ message: "Student not found" });

        if (student.school.toString() !== req.user.school.toString())
            return res.status(403).json({ message: "Unauthorized" });

        return res.status(200).json({ student });
    } catch (err) {
        console.error("Error fetching student:", err);
        return res.status(500).json({ message: err.message || "Server error while fetching student" });
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
        return res.status(500).json({ message: err.message || "Server error while deleting student" });
    }
};

const editOwnProfile = async (req, res) => {
    try {
        const userId = req.user._id;
        const existing = await User.findById(userId);

        if (!existing)
            return res.status(404).json({ message: "User not found" });

        const updatedImages = await uploadFiles(req.files, existing.images);

        const updatableFields = {
            name: req.body.name ?? existing.name,
            email: req.body.email ?? existing.email,
            phone: req.body.phone ?? existing.phone,
            address: req.body.address ?? existing.address,
            cnic: req.body.cnic ?? existing.cnic,
            images: updatedImages,
        };

        if (existing.role === "teacher" || existing.role === "admin_office") {
            updatableFields.salary = req.body.salary ?? existing.salary;
            updatableFields.joiningDate = req.body.joiningDate ?? existing.joiningDate;
        } else if (existing.role === "student") {
            updatableFields.fatherName = req.body.fatherName ?? existing.fatherName;
            updatableFields.rollNo = req.body.rollNo ?? existing.rollNo;
        }

        const updated = await User.findByIdAndUpdate(userId, updatableFields, { new: true });

        return res.status(200).json({
            message: "Profile updated successfully",
            user: updated
        });

    } catch (err) {
        console.error("Error updating profile:", err);
        return res.status(500).json({ message: err.message || "Server error while updating profile" });
    }
};


module.exports = {
    addEmployeeBySchool,
    editEmployeeBySchool,
    getAllEmployeesBySchool,
    getEmployeeById,
    deleteEmployeeBySchool,
    addStudentBySchool,
    getAllStudentsBySchool,
    getStudentsBySection,
    getStudentById,
    editStudentBySchool,
    deleteStudentBySchool,
    editOwnProfile
};