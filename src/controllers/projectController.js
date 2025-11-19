const Project = require("../models/Project");
const ClassSection = require("../models/ClassSection");
const User = require("../models/User");
const mongoose = require("mongoose");

const formatDate = d => {
  const D = d ? new Date(d) : new Date();
  return `${D.getFullYear()}-${String(D.getMonth()+1).padStart(2,"0")}-${String(D.getDate()).padStart(2,"0")}`;
};

// teacher creates project
const createProject = async (req, res) => {
  try {
    const school = req.user.school;
    const teacherId = req.user._id;
    const { title, description, classId, sectionId, targetType, studentIds, attachments, deadline, maxMarks } = req.body;

    if (!title || !classId || !sectionId || !targetType) {
      return res.status(400).json({ message: "title, classId, sectionId and targetType are required" });
    }

    if (targetType === "students" && (!Array.isArray(studentIds) || studentIds.length === 0)) {
      return res.status(400).json({ message: "studentIds required when targetType is 'students'" });
    }

    // validate class and (if studentIds) students
    const classDoc = await ClassSection.findById(classId);
    if (!classDoc) return res.status(404).json({ message: "Class not found" });

    if (targetType === "students") {
      // ensure all studentIds exist and belong to same school
      const found = await User.find({ _id: { $in: studentIds }, role: "student", school });
      if (found.length !== studentIds.length) {
        return res.status(400).json({ message: "Some studentIds are invalid or do not belong to this school" });
      }
    }

    const project = await Project.create({
      school,
      title,
      description: description || "",
      classId, sectionId,
      assignedBy: teacherId,
      targetType,
      studentIds: targetType === "students" ? studentIds : [],
      attachments: Array.isArray(attachments) ? attachments : [],
      deadline: deadline ? formatDate(deadline) : undefined,
      maxMarks
    });

    return res.status(201).json({ message: "Project created", project });
  } catch (err) {
    console.error("createProject error:", err);
    return res.status(500).json({ message: "Server error", error: err.message });
  }
};

// get projects for teacher by class/section or all created by teacher
const getProjectsForTeacher = async (req, res) => {
  try {
    const school = req.user.school;
    const teacherId = req.user._id;
    const { classId, sectionId } = req.query;
    const filter = { school };

    if (classId) filter.classId = classId;
    if (sectionId) filter.sectionId = sectionId;

    // teacher can view projects assigned by them OR projects for the class/section (optionally)
    filter.$or = [{ assignedBy: teacherId }, { classId: filter.classId || { $exists: true } }];

    const projects = await Project.find(filter)
      .populate("assignedBy", "name email")
      .populate("classId", "class sections")
      .sort({ createdAt: -1 })
      .lean();

    return res.status(200).json({ total: projects.length, projects });
  } catch (err) {
    console.error("getProjectsForTeacher error:", err);
    return res.status(500).json({ message: "Server error", error: err.message });
  }
};

// get projects visible to a student (their section OR assigned specifically to them)
const getProjectsForStudent = async (req, res) => {
  try {
    const school = req.user.school;
    const studentId = req.user._id;
    const classId = req.user.classId || req.user.classInfo?.id;
    const sectionId = req.user.sectionId || req.user.sectionInfo?.id;

    if (!classId || !sectionId) return res.status(400).json({ message: "Student not assigned to class/section" });

    const projects = await Project.find({
      school,
      $or: [
        { targetType: "section", classId, sectionId },
        { targetType: "students", studentIds: studentId }
      ]
    })
    .populate("assignedBy", "name")
    .sort({ deadline: 1, createdAt: -1 })
    .lean();

    return res.status(200).json({ total: projects.length, projects });
  } catch (err) {
    console.error("getProjectsForStudent error:", err);
    return res.status(500).json({ message: "Server error", error: err.message });
  }
};

// update project (only assignedBy or admin)
const updateProject = async (req, res) => {
  try {
    const { id } = req.params;
    const project = await Project.findById(id);
    if (!project) return res.status(404).json({ message: "Project not found" });

    // allow only creator or admin to update (you can expand check)
    if (String(project.assignedBy) !== String(req.user._id) && req.user.role !== "admin_office") {
      return res.status(403).json({ message: "Not authorized to update" });
    }

    // partial update allowed
    const updated = await Project.findByIdAndUpdate(id, { $set: req.body }, { new: true });
    return res.status(200).json({ message: "Project updated", project: updated });
  } catch (err) {
    console.error("updateProject error:", err);
    return res.status(500).json({ message: "Server error", error: err.message });
  }
};

// delete project
const deleteProject = async (req, res) => {
  try {
    const { id } = req.params;
    const project = await Project.findById(id);
    if (!project) return res.status(404).json({ message: "Project not found" });

    if (String(project.assignedBy) !== String(req.user._id) && req.user.role !== "admin_office") {
      return res.status(403).json({ message: "Not authorized to delete" });
    }

    await project.deleteOne();
    return res.status(200).json({ message: "Project deleted" });
  } catch (err) {
    console.error("deleteProject error:", err);
    return res.status(500).json({ message: "Server error", error: err.message });
  }
};

module.exports = {
  createProject,
  getProjectsForTeacher,
  getProjectsForStudent,
  updateProject,
  deleteProject
};
