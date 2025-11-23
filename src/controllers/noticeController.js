const Notice = require("../models/Notice");
const User = require("../models/User");

const formatDate = d => {
  if (!d) return undefined;
  const D = new Date(d);
  return `${D.getFullYear()}-${String(D.getMonth()+1).padStart(2,"0")}-${String(D.getDate()).padStart(2,"0")}`;
};

const createNotice = async (req, res) => {
  try {
    const school = req.user.school;
    const createdBy = req.user._id;
    const { title, message, target, targetTeacherIds, targetStudentIds, classId, sectionId, category, startDate, endDate, attachments, pinned } = req.body;

    if (!title || !message) return res.status(400).json({ message: "title and message required" });

    // validate targets if required
    if (target === "selected_teachers" && (!Array.isArray(targetTeacherIds) || targetTeacherIds.length === 0)) {
      return res.status(400).json({ message: "targetTeacherIds required when target is selected_teachers" });
    }

    if (target === "selected_students" && (!Array.isArray(targetStudentIds) || targetStudentIds.length === 0)) {
      return res.status(400).json({ message: "targetStudentIds required when target is selected_students" });
    }

    const notice = await Notice.create({
      school, title, message, createdBy, target: target || "all", targetTeacherIds: targetTeacherIds || [], targetStudentIds: targetStudentIds || [], classId, sectionId, category: category || "notice", startDate: formatDate(startDate), endDate: formatDate(endDate), attachments: attachments || [], pinned: !!pinned
    });

    return res.status(201).json({ message: "Notice created", notice });
  } catch (err) {
    console.error("createNotice error:", err);
    return res.status(500).json({ message: "Server error", error: err.message });
  }
};

// get notices relevant to a teacher (filters: all, selected)
const getNoticesForTeacher = async (req, res) => {
  try {
    const school = req.user.school;
    const teacherId = req.user._id;
    const { classId, sectionId, category, activeOnly } = req.query;
    const now = formatDate(new Date());

    const base = { school };

    if (classId) base.classId = classId;
    if (sectionId) base.sectionId = sectionId;
    if (category) base.category = category;

    const query = {
      $and: [
        base,
        {
          $or: [
            { target: "all" },
            { target: "all_teachers" },
            { target: "selected_teachers", targetTeacherIds: teacherId },
            { target: "custom", targetTeacherIds: teacherId }
          ]
        }
      ]
    };

    if (activeOnly === "true") {
      query.$and.push({
        $or: [
          { startDate: { $exists: false } },
          { startDate: { $lte: now } }
        ],
      });
      query.$and.push({
        $or: [
          { endDate: { $exists: false } },
          { endDate: { $gte: now } }
        ],
      });
    }

    const notices = await Notice.find(query).populate("createdBy", "name email").sort({ pinned: -1, createdAt: -1 }).lean();
    return res.status(200).json({ total: notices.length, notices });
  } catch (err) {
    console.error("getNoticesForTeacher error:", err);
    return res.status(500).json({ message: "Server error", error: err.message });
  }
};

// get notices for student (similar logic)
const getNoticesForStudent = async (req, res) => {
  try {
    const school = req.user.school;
    const studentId = req.user._id;
    const classId = req.user.classId || req.user.classInfo?.id;
    const sectionId = req.user.sectionId || req.user.sectionInfo?.id;
    const { category, activeOnly } = req.query;
    const now = formatDate(new Date());

    const base = { school };
    if (category) base.category = category;

    const query = {
      $and: [
        base,
        {
          $or: [
            { target: "all" },
            { target: "all_students" },
            { target: "selected_students", targetStudentIds: studentId },
            { target: "custom", targetStudentIds: studentId },
            // notices targeted by class/section (optional)
            { classId },
            { sectionId }
          ]
        }
      ]
    };

    if (activeOnly === "true") {
      query.$and.push({
        $or: [
          { startDate: { $exists: false } },
          { startDate: { $lte: now } }
        ],
      });
      query.$and.push({
        $or: [
          { endDate: { $exists: false } },
          { endDate: { $gte: now } }
        ],
      });
    }

    const notices = await Notice.find(query).populate("createdBy", "name email").sort({ pinned: -1, createdAt: -1 }).lean();
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
  getNoticesForTeacher,
  getNoticesForStudent,
  updateNotice,
  deleteNotice
};
