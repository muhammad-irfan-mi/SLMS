const ExamSchedule = require("../models/ExamSchedule");
const Subject = require("../models/Subject");
const ClassSection = require("../models/ClassSection");
const User = require("../models/User");

// Helper
function isTimeOverlap(start1, end1, start2, end2) {
  const toMinutes = (t) => {
    const [h, m] = t.split(":").map(Number);
    return h * 60 + m;
  };
  const s1 = toMinutes(start1), e1 = toMinutes(end1);
  const s2 = toMinutes(start2), e2 = toMinutes(end2);
  return s1 < e2 && s2 < e1;
}

console.log(isTimeOverlap("09:00", "12:00", "11:00", "13:00")); // true
console.log(isTimeOverlap("09:00", "12:00", "12:00", "13:00"));

const addExamSchedule = async (req, res) => {
  try {
    const { classId, sectionId, day, subjectId, startTime, endTime, teacherId, type, year } = req.body;
    const schoolId = req.user.school;

    if (!classId || !sectionId || !subjectId || !teacherId || !day || !startTime || !endTime || !type || !year) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    const [classExists, subjectExists, teacherExists] = await Promise.all([
      ClassSection.findById(classId),
      Subject.findById(subjectId),
      User.findById(teacherId),
    ]);

    if (!classExists) return res.status(404).json({ message: "Class not found" });
    if (!subjectExists) return res.status(404).json({ message: "Subject not found" });
    if (!teacherExists) return res.status(404).json({ message: "Teacher not found" });

    // Check subject belongs to class & section
    if (subjectExists.class.toString() !== classId.toString() ||
      (subjectExists.sectionId && subjectExists.sectionId.toString() !== sectionId.toString())) {
      return res.status(400).json({ message: "Subject does not belong to the given class and section." });
    }

    const existingSchedules = await ExamSchedule.find({ school: schoolId, teacherId, day });
    for (const sched of existingSchedules) {
      if (isTimeOverlap(startTime, endTime, sched.startTime, sched.endTime)) {
        return res.status(400).json({ message: "Teacher already assigned another exam at this time.", conflict: sched });
      }
    }

    const subjectConflict = await ExamSchedule.findOne({
      school: schoolId,
      classId,
      sectionId,
      subjectId,
      type,
      year,
    });
    if (subjectConflict) {
      return res.status(400).json({
        message: `This subject already scheduled for ${type} in ${year} for this class & section.`,
      });
    }

    const newSchedule = await ExamSchedule.create({ school: schoolId, classId, sectionId, subjectId, teacherId, day, startTime, endTime, type, year });
    res.status(201).json({ message: "Exam schedule added successfully.", schedule: newSchedule });

  } catch (error) {
    console.error("Add exam schedule error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

const getSchedule = async (req, res) => {
  try {
    const { classId, sectionId, teacherId, type, year, day } = req.query;
    const schoolId = req.user.school;

    const filter = { school: schoolId };
    if (classId) filter.classId = classId;
    if (sectionId) filter.sectionId = sectionId;
    if (teacherId) filter.teacherId = teacherId;
    if (type) filter.type = type;
    if (year) filter.year = year;
    if (day) filter.day = day;

    const schedules = await ExamSchedule.find(filter)
      .populate("subjectId", "name code")
      .populate("teacherId", "name email")
      .populate("classId", "class sections");

    const formatted = [];

    for (const item of schedules) {
      const classDoc = item.classId;
      let sectionObj = null;

      if (classDoc && Array.isArray(classDoc.sections)) {
        const foundSection = classDoc.sections.find(
          (sec) => sec._id.toString() === item.sectionId.toString()
        );
        if (foundSection) sectionObj = foundSection;
      }

      formatted.push({
        _id: item._id,
        school: item.school,
        class: {
          _id: classDoc?._id,
          name: classDoc?.class || "Unknown",
        },
        section: sectionObj
          ? { _id: sectionObj._id, name: sectionObj.name }
          : { _id: item.sectionId, name: "Unknown" },
        subject: item.subjectId,
        teacher: item.teacherId,
        day: item.day,
        startTime: item.startTime,
        endTime: item.endTime,
        type: item.type,
        year: item.year,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
      });
    }

    res.status(200).json({
      total: formatted.length,
      schedule: formatted,
    });
  } catch (error) {
    console.error("Get schedule error:", error);
    res
      .status(500)
      .json({ message: "Server error", error: error.message });
  }
};

const getScheduleByTeacher = async (req, res) => {
  try {
    const teacherId = req.user._id;
    const schedule = await ExamSchedule.find({ teacherId })
      .populate("classId", "class sections")
      .populate("subjectId", "name code");

    res.status(200).json({ total: schedule.length, schedule });
  } catch (error) {
    console.error("Teacher schedule error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

const getScheduleByStudent = async (req, res) => {
  try {
    const student = req.user;

    if (student.role !== "student")
      return res.status(403).json({ message: "Access denied: Student only" });

    const classId = student.classId || student.classInfo?.id;
    const sectionId = student.sectionId || student.sectionInfo?.id;

    if (!classId || !sectionId)
      return res.status(400).json({ message: "Student not assigned to class/section" });

    const schedule = await ExamSchedule.find({
      classId,
      sectionId,
      school: student.school,
    })
      .populate("subjectId", "name code")
      .populate("teacherId", "name email")
      .populate("classId", "class");

    res.status(200).json({ total: schedule.length, schedule });
  } catch (error) {
    console.error("Get student schedule error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

const updateExamSchedule = async (req, res) => {
  try {
    const { id } = req.params;
    const schoolId = req.user.school;

    const existingSchedule = await ExamSchedule.findById(id);
    if (!existingSchedule) return res.status(404).json({ message: "Schedule not found" });

    const updatedData = { ...existingSchedule.toObject(), ...req.body };
    const { classId, sectionId, day, subjectId, startTime, endTime, teacherId, type, year } = updatedData;

    if (req.body.classId || req.body.sectionId || req.body.subjectId || req.body.teacherId) {
      const [classExists, subjectExists, teacherExists] = await Promise.all([
        ClassSection.findById(classId),
        Subject.findById(subjectId),
        User.findById(teacherId),
      ]);

      if (!classExists) return res.status(404).json({ message: "Class not found" });
      if (!subjectExists) return res.status(404).json({ message: "Subject not found" });
      if (!teacherExists) return res.status(404).json({ message: "Teacher not found" });

      if (subjectExists.class.toString() !== classId.toString() ||
        (subjectExists.sectionId && subjectExists.sectionId.toString() !== sectionId.toString())) {
        return res.status(400).json({ message: "Subject does not belong to the given class and section." });
      }
    }

    const existingSchedules = await ExamSchedule.find({ _id: { $ne: id }, school: schoolId, teacherId, day });
    for (const sched of existingSchedules) {
      if (isTimeOverlap(startTime, endTime, sched.startTime, sched.endTime)) {
        return res.status(400).json({ message: "Teacher already assigned another exam at this time.", conflict: sched });
      }
    }

    const subjectConflict = await ExamSchedule.findOne({
      _id: { $ne: id },
      school: schoolId,
      classId,
      sectionId,
      subjectId,
      type,
      year,
    });
    if (subjectConflict) {
      return res.status(400).json({
        message: `This subject already scheduled for ${type} in ${year} for this class & section.`,
      });
    }

    const updated = await ExamSchedule.findByIdAndUpdate(id, { $set: req.body }, { new: true });
    res.status(200).json({ message: "Exam schedule updated successfully", schedule: updated });

  } catch (error) {
    console.error("Update schedule error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

const deleteSchedule = async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await ExamSchedule.findByIdAndDelete(id);
    if (!deleted) return res.status(404).json({ message: "Schedule not found" });

    res.status(200).json({ message: "Schedule deleted successfully" });
  } catch (error) {
    console.error("Delete schedule error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

module.exports = {
  addExamSchedule,
  getSchedule,
  getScheduleByTeacher,
  getScheduleByStudent,
  updateExamSchedule,
  deleteSchedule,
};
