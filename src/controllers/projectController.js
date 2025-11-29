const Project = require("../models/Project");
const ClassSection = require("../models/ClassSection");
const User = require("../models/User");
const mongoose = require("mongoose");
const { deleteFileFromS3, uploadFileToS3 } = require("../services/s3.service");

const formatDate = d => {
  const D = d ? new Date(d) : new Date();
  return `${D.getFullYear()}-${String(D.getMonth() + 1).padStart(2, "0")}-${String(D.getDate()).padStart(2, "0")}`;
};

async function handleProjectUploads(files, existing = {}) {
  let images = existing.images || [];
  let pdf = existing.pdf || null;

  if (files?.images) {
    for (const img of images) {
      await deleteFileFromS3(img);
    }

    images = [];

    for (const file of files.images.slice(0, 2)) {
      const uploaded = await uploadFileToS3({
        fileBuffer: file.buffer,
        fileName: file.originalname,
        mimeType: file.mimetype,
      });
      images.push(uploaded);
    }
  }

  if (files?.pdf?.[0]) {
    if (pdf) await deleteFileFromS3(pdf);

    pdf = await uploadFileToS3({
      fileBuffer: files.pdf[0].buffer,
      fileName: files.pdf[0].originalname,
      mimeType: files.pdf[0].mimetype,
    });
  }

  return { images, pdf };
}

// teacher creates project
const createProject = async (req, res) => {
  try {
    const school = req.user.school;
    const teacherId = req.user._id;

    const {
      title, description, detail,
      classId, sectionId,
      targetType, studentIds,
      deadline, maxMarks
    } = req.body;

    if (!title || !classId || !sectionId || !targetType) {
      return res.status(400).json({
        message: "title, classId, sectionId and targetType are required"
      });
    }

    // 1. Validate class
    const classDoc = await ClassSection.findById(classId);
    if (!classDoc) return res.status(404).json({ message: "Class not found" });

    // 2. Validate section belongs to class
    const sectionInClass = classDoc.sections.find(
      sec => String(sec._id) === String(sectionId)
    );

    if (!sectionInClass) {
      return res.status(400).json({
        message: "Section does NOT belong to the selected class"
      });
    }

    // 3. If targetType == students → validate each student
    if (targetType === "students") {
      if (!Array.isArray(studentIds) || studentIds.length === 0) {
        return res.status(400).json({
          message: "studentIds required when targetType is 'students'"
        });
      }

      const students = await User.find({
        _id: { $in: studentIds },
        role: "student",
        school
      }).lean();

      if (students.length !== studentIds.length) {
        return res.status(400).json({
          message: "Some studentIds are invalid or do not belong to this school"
        });
      }

      // Validate class & section match for each student
      const invalidStudents = students.filter(st =>
        String(st.classInfo?.id) !== String(classId) ||
        String(st.sectionInfo?.id) !== String(sectionId)
      );

      if (invalidStudents.length > 0) {
        return res.status(400).json({
          message: "Some students are NOT in the selected class/section",
          invalidStudents: invalidStudents.map(s => ({
            id: s._id,
            name: s.name,
            class: s.classInfo?.name,
            section: s.sectionInfo?.name
          }))
        });
      }
    }

    const uploads = await handleProjectUploads(req.files);
    // CREATE PROJECT
    const project = await Project.create({
      school,
      title,
      description: description || "",
      detail: detail || "",
      classId,
      sectionId,
      assignedBy: teacherId,
      targetType,
      studentIds: targetType === "students" ? studentIds : [],
      deadline: deadline ? formatDate(deadline) : undefined,
      maxMarks,

      images: uploads.images,
      pdf: uploads.pdf
    });

    return res.status(201).json({
      message: "Project created successfully",
      project
    });

  } catch (err) {
    console.error("createProject error:", err);
    return res.status(500).json({
      message: "Server error",
      error: err.message
    });
  }
};

// get projects for teacher by class/section or all created by teacher
const getProjectsForTeacher = async (req, res) => {
  try {
    const school = req.user.school;
    const teacherId = req.user._id;
    const { classId, sectionId, deadlineStatus, creationDate, createdTo } = req.query;

    const filter = {
      school,
      assignedBy: teacherId,
    };

    if (classId) filter.classId = classId;
    if (sectionId) filter.sectionId = sectionId;

    if (deadlineStatus === "upcoming") {
      filter.deadline = { $gte: new Date() };
    }

    if (deadlineStatus === "expired") {
      filter.deadline = { $lt: new Date() };
    }

    if (creationDate || createdTo) {
      filter.createdAt = {};

      if (creationDate) {
        filter.createdAt.$gte = new Date(creationDate);
      }

      if (createdTo) {
        filter.createdAt.$lte = new Date(createdTo);
      }
    }

    const projects = await Project.find(filter)
      .populate("assignedBy", "name email")
      .populate("classId", "class sections")
      .sort({ createdAt: -1 })
      .lean();

    return res.status(200).json({
      total: projects.length,
      projects,
    });

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
    if (!project)
      return res.status(404).json({ message: "Project not found" });

    if (String(project.assignedBy) !== String(req.user._id) &&
      req.user.role !== "admin_office") {
      return res.status(403).json({ message: "Not authorized" });
    }

    const updates = req.body;

    const uploads = await handleProjectUploads(req.files, {
      images: project.images,
      pdf: project.pdf
    });

    Object.keys(updates).forEach(key => {
      project[key] = updates[key];
    });

    project.images = uploads.images.length > 0 ? uploads.images : project.images;
    project.pdf = uploads.pdf ? uploads.pdf : project.pdf;

    await project.save();

    return res.status(200).json({
      message: "Project updated successfully",
      project
    });

  } catch (err) {
    console.error("updateProject error:", err);
    return res.status(500).json({ message: err.message });
  }
};

// delete project
const deleteProject = async (req, res) => {
  try {
    const { id } = req.params;

    const project = await Project.findById(id);
    if (!project)
      return res.status(404).json({ message: "Project not found" });

    if (String(project.assignedBy) !== String(req.user._id) &&
      req.user.role !== "admin_office") {
      return res.status(403).json({ message: "Not authorized" });
    }

    // delete images
    if (project.images && project.images.length > 0) {
      for (const img of project.images) {
        await deleteFileFromS3(img);
      }
    }

    // delete pdf
    if (project.pdf) {
      await deleteFileFromS3(project.pdf);
    }

    await project.deleteOne();
    return res.status(200).json({ message: "Project deleted" });

  } catch (err) {
    console.error("deleteProject error:", err);
    return res.status(500).json({ message: err.message });
  }
};

module.exports = {
  createProject,
  getProjectsForTeacher,
  getProjectsForStudent,
  updateProject,
  deleteProject
};
