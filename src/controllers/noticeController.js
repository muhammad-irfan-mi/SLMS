const ClassSection = require("../models/ClassSection");
const Notice = require("../models/Notice");
const User = require("../models/User");

const formatDate = d => {
  if (!d) return undefined;
  const D = new Date(d);
  return `${D.getFullYear()}-${String(D.getMonth() + 1).padStart(2, "0")}-${String(D.getDate()).padStart(2, "0")}`;
};


const createNotice = async (req, res) => {
  try {
    const school = req.user.school;
    const createdBy = req.user._id;

    const {
      title, message, target, targetTeacherIds, targetStudentIds,
      classId, sectionId, category, startDate, endDate, attachments, pinned
    } = req.body;

    if (!title || !message) {
      return res.status(400).json({ message: "Title and message are required" });
    }

    if (target === "selected_teachers" && (!targetTeacherIds || targetTeacherIds.length === 0)) {
      return res.status(400).json({ message: "targetTeacherIds required" });
    }

    if (target === "selected_students" && (!targetStudentIds || targetStudentIds.length === 0)) {
      return res.status(400).json({ message: "targetStudentIds required" });
    }

    let classExists = null;

    if (classId) {
      classExists = await ClassSection.findById(classId);
      if (!classExists) {
        return res.status(400).json({ message: "Invalid classId - class not found" });
      }

      if (sectionId) {
        const sectionExists = classExists.sections.some(
          (sec) => String(sec._id) === String(sectionId)
        );

        if (!sectionExists) {
          return res.status(400).json({
            message: "Invalid sectionId - section not found in this class"
          });
        }
      }
    }

    const notice = await Notice.create({
      school,
      title,
      message,
      createdBy,
      target: target || "all",
      targetTeacherIds: targetTeacherIds || [],
      targetStudentIds: targetStudentIds || [],
      classId: classId || null,
      sectionId: sectionId || null,
      category: category || "notice",
      startDate: startDate ? formatDate(startDate) : undefined,
      endDate: endDate ? formatDate(endDate) : undefined,
      attachments: attachments || [],
      pinned: !!pinned
    });

    return res.status(201).json({ message: "Notice created", notice });

  } catch (err) {
    console.error("createNotice error:", err);
    return res.status(500).json({ message: "Server error", error: err.message });
  }
};

// get notices relevant to a teacher (filters: all, selected)
const getNotices = async (req, res) => {
  try {
    const user = req.user;
    const school = user.school;

    const { classId, sectionId, category, activeOnly } = req.query;

    const now = new Date();
    const base = { school };

    if (classId) base.classId = classId;
    if (sectionId) base.sectionId = sectionId;
    if (category) base.category = category;

    let roleFilters = [];

    if (user.role === "teacher") {
      roleFilters = [
        { target: "all_teachers" },
        { target: "class" },
        { target: "section" },
        { target: "selected_teachers", targetTeacherIds: user._id },
        { target: "custom", targetTeacherIds: user._id }
      ];
    }

    // if (user.role === "student") {
    //   roleFilters = [
    //     { target: "all" },
    //     { target: "all_students" },
    //     { target: "class" },
    //     { target: "section" },
    //     { target: "selected_students", targetStudentIds: user._id },
    //     { target: "custom", targetStudentIds: user._id }
    //   ];
    // }
    if (user.role === "admin") {
      roleFilters = [
        { target: "all" },
        { target: "all_teachers" },
        { target: "all_students" },
        { target: "class" },
        { target: "section" },
        { target: "selected_teachers" },
        { target: "selected_students" },
        { target: "custom" }
      ];
    }

    const query = {
      $and: [
        base,
        { $or: roleFilters }
      ]
    };

    if (activeOnly === "true") {
      query.$and.push({
        $or: [
          { startDate: { $exists: false } },
          { startDate: { $lte: now } }
        ]
      });
      query.$and.push({
        $or: [
          { endDate: { $exists: false } },
          { endDate: { $gte: now } }
        ]
      });
    }

    const notices = await Notice.find(query)
      .populate("createdBy", "name email")
      .sort({ pinned: -1, createdAt: -1 })
      .lean();

    return res.status(200).json({ total: notices.length, notices });

  } catch (err) {
    console.error("getNotices error:", err);
    return res.status(500).json({ message: "Server error", error: err.message });
  }
};

// get notices for student
const getNoticesForStudent = async (req, res) => {
  try {
    const school = req.user.school;
    const studentId = req.user._id;
    const classId = req.user.classInfo?.id;
    const sectionId = req.user.sectionInfo?.id;
    const { category, activeOnly } = req.query;
    const now = new Date();

    const base = { school };
    if (category) base.category = category;

    const query = {
      $and: [
        base,
        {
          $or: [
            // Notices targeted to the student's class
            { target: "class", classId: classId },
            // Notices targeted to the student's section
            { target: "section", classId: classId, sectionId: sectionId },
            // Notices targeted to the student individually
            { target: "selected_students", targetStudentIds: studentId },
            // Custom notices including student
            { target: "custom", targetStudentIds: studentId },
          ]
        }
      ]
    };

    // Only active notices
    if (activeOnly === "true") {
      query.$and.push({
        $or: [
          { startDate: { $exists: false } },
          { startDate: { $lte: now } }
        ]
      });
      query.$and.push({
        $or: [
          { endDate: { $exists: false } },
          { endDate: { $gte: now } }
        ]
      });
    }

    const notices = await Notice.find(query)
      .populate("createdBy", "name email")
      .sort({ pinned: -1, createdAt: -1 })
      .lean();

    return res.status(200).json({ total: notices.length, notices });

  } catch (err) {
    console.error("getNoticesForStudent error:", err);
    return res.status(500).json({ message: "Server error", error: err.message });
  }
};


const updateNotice = async (req, res) => {
  try {
    const { id } = req.params;
    const notice = await Notice.findById(id);
    if (!notice) return res.status(404).json({ message: "Notice not found" });

    // only creator or admin can edit
    if (String(notice.createdBy) !== String(req.user._id) && req.user.role !== "admin_office") {
      return res.status(403).json({ message: "Not authorized to edit" });
    }

    const updated = await Notice.findByIdAndUpdate(id, { $set: req.body }, { new: true });
    return res.status(200).json({ message: "Notice updated", notice: updated });
  } catch (err) {
    console.error("updateNotice error:", err);
    return res.status(500).json({ message: "Server error", error: err.message });
  }
};

const deleteNotice = async (req, res) => {
  try {
    const { id } = req.params;
    const notice = await Notice.findById(id);
    if (!notice) return res.status(404).json({ message: "Notice not found" });

    if (String(notice.createdBy) !== String(req.user._id) && req.user.role !== "admin_office") {
      return res.status(403).json({ message: "Not authorized to delete" });
    }

    await notice.deleteOne();
    return res.status(200).json({ message: "Notice deleted" });
  } catch (err) {
    console.error("deleteNotice error:", err);
    return res.status(500).json({ message: "Server error", error: err.message });
  }
};

module.exports = {
  createNotice,
  getNotices,
  getNoticesForStudent,
  updateNotice,
  deleteNotice
};
