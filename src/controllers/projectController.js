const Project = require("../models/Project");
const ClassSection = require("../models/ClassSection");
const User = require("../models/User");
const Schedule = require("../models/Schedule");
const { deleteFileFromS3, uploadFileToS3 } = require("../services/s3.service");

const formatDate = d => {
  const D = d ? new Date(d) : new Date();
  return `${D.getFullYear()}-${String(D.getMonth() + 1).padStart(2, "0")}-${String(D.getDate()).padStart(2, "0")}`;
};

async function handleProjectUploads(files, existing = {}) {
  let images = existing.images || [];
  let pdf = existing.pdf || null;

  if (files?.images) {
    // delete old images
    for (const img of images)
      await deleteFileFromS3(img);

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

  // replace pdf
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
      subjectId,
      targetType, studentIds,
      deadline, maxMarks
    } = req.body;

    if (!title || !classId || !sectionId || !subjectId) {
      return res.status(400).json({
        message: "title, classId, sectionId and subjectId are required"
      });
    }

    // Validate class
    const classDoc = await ClassSection.findById(classId);
    if (!classDoc)
      return res.status(404).json({ message: "Class not found" });

    // Validate section inside class
    const sectionInClass = classDoc.sections.find(s => String(s._id) === sectionId);
    if (!sectionInClass)
      return res.status(400).json({ message: "Section does NOT belong to selected class" });

    // CHECK teacher is assigned subject in Schedule
    const schedule = await Schedule.findOne({
      school,
      classId,
      sectionId,
      subjectId,
      teacherId
    });

    if (!schedule) {
      return res.status(403).json({
        message: "Teacher is NOT assigned this subject in schedule"
      });
    }

    // If students selected, validate each
    if (targetType === "students") {
      if (!studentIds?.length)
        return res.status(400).json({ message: "studentIds required" });

      const students = await User.find({
        _id: { $in: studentIds },
        role: "student",
        school
      }).lean();

      if (students.length !== studentIds.length)
        return res.status(400).json({ message: "Invalid students" });

      const invalid = students.filter(
        st => String(st.classInfo?.id) !== classId || String(st.sectionInfo?.id) !== sectionId
      );

      if (invalid.length)
        return res.status(400).json({
          message: "Some students NOT in this class/section",
          invalidStudents: invalid.map(s => ({ id: s._id, name: s.name }))
        });
    }

    // Uploads
    const uploads = await handleProjectUploads(req.files);

    const project = await Project.create({
      school,
      title,
      description: description || "",
      detail: detail || "",
      classId,
      sectionId,
      subjectId,
      assignedBy: teacherId,
      targetType,
      studentIds: targetType === "students" ? studentIds : [],
      deadline: formatDate(deadline),
      maxMarks,
      images: uploads.images,
      pdf: uploads.pdf
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

    const { classId, sectionId, subjectId, page = 1, limit = 10 } = req.query;

    const filter = {
      school,
      assignedBy: teacherId,
    };

    if (classId) filter.classId = classId;
    if (sectionId) filter.sectionId = sectionId;
    if (subjectId) filter.subjectId = subjectId;

    const skip = (page - 1) * limit;

    const projects = await Project.find(filter)
      .populate("classId", "class sections")
      .populate("subjectId", "name")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit));

    const total = await Project.countDocuments(filter);

    return res.status(200).json({
      total,
      page: Number(page),
      totalPages: Math.ceil(total / limit),
      projects
    });

  } catch (err) {
    console.error("getProjectsForTeacher error:", err);
    return res.status(500).json({ message: err.message });
  }
};

// get projects visible to a student (their section OR assigned specifically to them)
const getProjectsForStudent = async (req, res) => {
  try {
    const school = req.user.school;
    const studentId = req.user._id;
    const classId = req.user.classInfo?.id;
    const sectionId = req.user.sectionInfo?.id;

    if (!classId || !sectionId)
      return res.status(400).json({ message: "Student not assigned to class/section" });

    const projects = await Project.find({
      school,
      $or: [
        { targetType: "section", classId, sectionId },
        { targetType: "students", studentIds: studentId }
      ]
    })
      .populate("assignedBy", "name")
      .populate("subjectId", "name")
      .sort({ deadline: 1 });

    return res.status(200).json({ total: projects.length, projects });

  } catch (err) {
    console.error("getProjectsForStudent error:", err);
    return res.status(500).json({ message: err.message });
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

    Object.assign(project, updates);

    project.images = uploads.images.length ? uploads.images : project.images;
    project.pdf = uploads.pdf || project.pdf;

    await project.save();

    return res.status(200).json({ message: "Project updated", project });

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
      return res.status(403).json({ message: "Not authorized to delete" });
    }

    for (const img of project.images)
      await deleteFileFromS3(img);

    if (project.pdf)
      await deleteFileFromS3(project.pdf);

    await project.deleteOne();

    return res.status(200).json({ message: "Project deleted successfully" });

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
