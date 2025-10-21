// const User = require("../models/User");
// const School = require("../models/School");
// const { uploadFileToS3, deleteFileFromS3 } = require("../services/s3.service");
// const ClassSection = require("../models/ClassSection");

// // Helper for S3 uploads
// async function uploadFiles(files, existingImages = {}) {
//     const images = { ...existingImages };

//     for (const key of ["cnicFront", "cnicBack", "recentPic"]) {
//         if (files?.[key]?.[0]) {
//             if (images[key]) await deleteFileFromS3(images[key]);
//             images[key] = await uploadFileToS3({
//                 fileBuffer: files[key][0].buffer,
//                 fileName: files[key][0].originalname,
//                 mimeType: files[key][0].mimetype,
//             });
//         }
//     }
//     return images;
// }

// // ADD EMPLOYEE (Teacher / Admin Office)
// const addEmployeeBySchool = async (req, res) => {
//     try {
//         const {
//             name,
//             email,
//             phone,
// address,
//             cnic,
//             role,
//             salary,
//             joiningDate,
//             subjectAssigned,
//             classId,
//             sectionId,
//         } = req.body;

//         if (!name || !email || !role)
//             return res.status(400).json({ message: "Name, email, and role are required" });

//         if (!["teacher", "admin_office"].includes(role))
//             return res.status(400).json({ message: "Invalid role for employee" });

//         const schoolId = req.user.school;
//         const existing = await User.findOne({ email });
//         if (existing) return res.status(400).json({ message: "User with this email already exists" });

//         const images = await uploadFiles(req.files);

//         let classInfo = null;
//         let sectionInfo = null;

//         // ✅ Find class & section from same model
//         if (role === "teacher" && classId) {
//             const classDoc = await ClassSection.findById(classId);
//             if (!classDoc) return res.status(400).json({ message: "Invalid class ID" });

//             classInfo = { id: classDoc._id, name: classDoc.class };

//             if (sectionId) {
//                 const sectionObj = classDoc.sections.find(sec => sec._id.toString() === sectionId);
//                 if (!sectionObj)
//                     return res.status(400).json({ message: "Invalid section ID for this class" });

//                 sectionInfo = { id: sectionObj._id, name: sectionObj.name };
//             }
//         }

//         const newUser = new User({
//             name,
//             email,
//             phone,
//             address,
//             cnic,
//             role,
//             salary: role === "teacher" ? salary : salary || null,
//             joiningDate,
//             subjectAssigned: role === "teacher" && subjectAssigned ? subjectAssigned.split(",") : [],
//             classInfo,
//             sectionInfo,
//             school: schoolId,
//             images,
//         });

//         await newUser.save();
//         return res.status(201).json({ message: "Employee added successfully", user: newUser });
//     } catch (err) {
//         console.error("Error adding employee:", err);
//         return res.status(500).json({ message: "Server error while adding employee", error: err.message });
//     }
// };

// // UPDATE EMPLOYEE
// const editEmployeeBySchool = async (req, res) => {
//     try {
//         const { id } = req.params;
//         const existing = await User.findById(id);
//         if (!existing || !["teacher", "admin_office"].includes(existing.role))
//             return res.status(404).json({ message: "Employee not found" });

//         if (existing.school.toString() !== req.user.school.toString())
//             return res.status(403).json({ message: "Unauthorized" });

//         const images = await uploadFiles(req.files, existing.images);

//         let classInfo = existing.classInfo;
//         let sectionInfo = existing.sectionInfo;

//         if (existing.role === "teacher" && req.body.classId) {
//             const classDoc = await ClassSection.findById(req.body.classId);
//             if (!classDoc) return res.status(400).json({ message: "Invalid class ID" });

//             classInfo = { id: classDoc._id, name: classDoc.class };

//             if (req.body.sectionId) {
//                 const sectionObj = classDoc.sections.find(sec => sec._id.toString() === req.body.sectionId);
//                 if (!sectionObj)
//                     return res.status(400).json({ message: "Invalid section ID for this class" });

//                 sectionInfo = { id: sectionObj._id, name: sectionObj.name };
//             }
//         }

//         const updatedFields = {
//             name: req.body.name ?? existing.name,
//             email: req.body.email ?? existing.email,
//             phone: req.body.phone ?? existing.phone,
//             address: req.body.address ?? existing.address,
//             cnic: req.body.cnic ?? existing.cnic,
//             salary: req.body.salary ?? existing.salary,
//             joiningDate: req.body.joiningDate ?? existing.joiningDate,
//             subjectAssigned: req.body.subjectAssigned
//                 ? req.body.subjectAssigned.split(",")
//                 : existing.subjectAssigned,
//             classInfo,
//             sectionInfo,
//             images,
//         };

//         const updated = await User.findByIdAndUpdate(id, updatedFields, { new: true });
//         return res.status(200).json({ message: "Employee updated successfully", user: updated });
//     } catch (err) {
//         console.error("Error updating employee:", err);
//         return res.status(500).json({ message: "Server error while updating employee", error: err.message });
//     }
// };

// // DELETE EMPLOYEE (Teacher / Admin Office)
// const deleteEmployeeBySchool = async (req, res) => {
//     try {
//         const { id } = req.params;
//         const employee = await User.findById(id);

//         if (!employee || !["teacher", "admin_office"].includes(employee.role))
//             return res.status(404).json({ message: "Employee not found" });

//         if (employee.school.toString() !== req.user.school.toString())
//             return res.status(403).json({ message: "Unauthorized" });

//         // Delete uploaded S3 images if exist
//         const { cnicFront, cnicBack, recentPic } = employee.images || {};
//         for (const fileUrl of [cnicFront, cnicBack, recentPic].filter(Boolean)) {
//             await deleteFileFromS3(fileUrl);
//         }

//         await employee.deleteOne();
//         return res.status(200).json({ message: "Employee deleted successfully" });
//     } catch (err) {
//         console.error("Error deleting employee:", err);
//         return res.status(500).json({
//             message: "Server error while deleting employee",
//             error: err.message,
//         });
//     }
// };

// // ADD STUDENT
// const addStudentBySchool = async (req, res) => {
//     try {
//         const {
//             name,
//             email,
//             phone,
//             address,
//             cnic,
//             fatherName,
//             classId,
//             sectionId,
//             rollNo,
//         } = req.body;

//         if (!name || !email)
//             return res.status(400).json({ message: "Name and email are required" });

//         const schoolId = req.user.school;
//         const existing = await User.findOne({ email });
//         if (existing) return res.status(400).json({ message: "Student with this email already exists" });

//         const classDoc = await ClassSection.findById(classId);
//         if (!classDoc) return res.status(400).json({ message: "Invalid class ID" });

//         const sectionObj = classDoc.sections.find(sec => sec._id.toString() === sectionId);
//         if (!sectionObj)
//             return res.status(400).json({ message: "Invalid section ID for this class" });

//         const images = await uploadFiles(req.files);

//         const newStudent = new User({
//             name,
//             email,
//             phone,
//             address,
//             cnic,
//             fatherName,
//             role: "student",
//             rollNo,
//             classInfo: { id: classDoc._id, name: classDoc.class },
//             sectionInfo: { id: sectionObj._id, name: sectionObj.name },
//             school: schoolId,
//             images,
//         });

//         await newStudent.save();
//         await School.findByIdAndUpdate(schoolId, { $inc: { noOfStudents: 1 } });

//         return res.status(201).json({ message: "Student added successfully", student: newStudent });
//     } catch (err) {
//         console.error("Error adding student:", err);
//         return res.status(500).json({ message: "Server error while adding student", error: err.message });
//     }
// };

// // UPDATE STUDENT
// const editStudentBySchool = async (req, res) => {
//     try {
//         const { id } = req.params;
//         const existing = await User.findById(id);

//         if (!existing || existing.role !== "student")
//             return res.status(404).json({ message: "Student not found" });

//         if (existing.school.toString() !== req.user.school.toString())
//             return res.status(403).json({ message: "Unauthorized" });

//         const images = await uploadFiles(req.files, existing.images);

//         let classInfo = existing.classInfo;
//         let sectionInfo = existing.sectionInfo;

//         if (req.body.classId) {
//             const classDoc = await ClassSection.findById(req.body.classId);
//             if (!classDoc) return res.status(400).json({ message: "Invalid class ID" });

//             classInfo = { id: classDoc._id, name: classDoc.class };

//             if (req.body.sectionId) {
//                 const sectionObj = classDoc.sections.find(sec => sec._id.toString() === req.body.sectionId);
//                 if (!sectionObj)
//                     return res.status(400).json({ message: "Invalid section ID for this class" });

//                 sectionInfo = { id: sectionObj._id, name: sectionObj.name };
//             }
//         }

//         const updatedData = {
//             name: req.body.name ?? existing.name,
//             email: req.body.email ?? existing.email,
//             phone: req.body.phone ?? existing.phone,
//             address: req.body.address ?? existing.address,
//             cnic: req.body.cnic ?? existing.cnic,
//             fatherName: req.body.fatherName ?? existing.fatherName,
//             rollNo: req.body.rollNo ?? existing.rollNo,
//             classInfo,
//             sectionInfo,
//             images,
//         };

//         const updated = await User.findByIdAndUpdate(id, updatedData, { new: true });
//         return res.status(200).json({ message: "Student updated successfully", student: updated });
//     } catch (err) {
//         console.error("Error updating student:", err);
//         return res.status(500).json({ message: "Server error while updating student", error: err.message });
//     }
// };

// // DELETE STUDENT
// const deleteStudentBySchool = async (req, res) => {
//     try {
//         const { id } = req.params;
//         const student = await User.findById(id);

//         if (!student || student.role !== "student")
//             return res.status(404).json({ message: "Student not found" });

//         if (student.school.toString() !== req.user.school.toString())
//             return res.status(403).json({ message: "Unauthorized" });

//         const { cnicFront, cnicBack, recentPic } = student.images || {};
//         for (const fileUrl of [cnicFront, cnicBack, recentPic].filter(Boolean))
//             await deleteFileFromS3(fileUrl);

//         await student.deleteOne();
//         await School.findByIdAndUpdate(req.user.school, { $inc: { noOfStudents: -1 } });

//         return res.status(200).json({ message: "Student deleted successfully" });
//     } catch (err) {
//         console.error("Error deleting student:", err);
//         return res.status(500).json({ message: "Server error while deleting student", error: err.message });
//     }
// };

// module.exports = {
//     addEmployeeBySchool,
//     editEmployeeBySchool,
//     deleteEmployeeBySchool,
//     addStudentBySchool,
//     editStudentBySchool,
//     deleteStudentBySchool,
// };







































const User = require("../models/User");
const School = require("../models/School");
const ClassSection = require("../models/ClassSection");
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

// Helper: Auto-fill Class and Section from IDs
async function getClassAndSection(classId, sectionId) {
    if (!classId) return { classInfo: null, sectionInfo: null };

    const classDoc = await ClassSection.findById(classId);
    if (!classDoc) throw new Error("Invalid class ID");

    const classInfo = { id: classDoc._id, name: classDoc.class };
    let sectionInfo = null;

    if (sectionId) {
        const sectionObj = classDoc.sections.find(
            (sec) => sec._id.toString() === sectionId
        );
        if (!sectionObj) throw new Error("Invalid section ID for this class");
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

        if (!name || !email || !role)
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

        // 🔹 Only for teacher who is incharge
        if (role === "teacher" && isIncharge === "true" && classId) {
            ({ classInfo, sectionInfo } = await getClassAndSection(classId, sectionId));
        }

        // 🔹 Ensure teacher always has isIncharge set (default false)
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
            isIncharge: inchargeFlag ?? false, // always set for teacher
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

        if (!name || !email)
            return res.status(400).json({ message: "Name and email are required" });

        const schoolId = req.user.school;
        const existing = await User.findOne({ email });
        if (existing)
            return res.status(400).json({ message: "Student with this email already exists" });

        const { classInfo, sectionInfo } = await getClassAndSection(classId, sectionId);
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

module.exports = {
    addEmployeeBySchool,
    editEmployeeBySchool,
    getAllEmployeesBySchool,
    getEmployeeById,
    deleteEmployeeBySchool,
    addStudentBySchool,
    getAllStudentsBySchool,
    getStudentById,
    editStudentBySchool,
    deleteStudentBySchool,
};