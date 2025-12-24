const ExamSchedule = require("../models/ExamSchedule");
const Subject = require("../models/Subject");
const ClassSection = require("../models/ClassSection");
const User = require("../models/User");

// HELPER 
const toMinutes = (t) => {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
};

const isOverlap = (s1, e1, s2, e2) =>
  toMinutes(s1) < toMinutes(e2) && toMinutes(s2) < toMinutes(e1);

const extractSection = (classObj, sectionId) => {
  const sec = classObj?.sections?.find(
    (s) => s._id.toString() === sectionId.toString()
  );
  return sec ? { _id: sec._id, name: sec.name } : null;
};

// ADD MULTIPLE EXAMS
const addExamSchedule = async (req, res) => {
  try {
    const school = req.user.school;
    const { type, year, schedules } = req.body;

    if (!type || !year || !Array.isArray(schedules) || !schedules.length) {
      return res.status(400).json({ message: "Invalid payload" });
    }

    const created = [];

    for (const item of schedules) {
      const {
        classId,
        sectionId,
        subjectId,
        teacherId,
        day,
        startTime,
        endTime,
      } = item;

      if (
        !classId ||
        !sectionId ||
        !subjectId ||
        !teacherId ||
        !day ||
        !startTime ||
        !endTime
      ) {
        return res.status(400).json({ message: "Missing fields in schedule" });
      }

      const [cls, subject, teacher] = await Promise.all([
        ClassSection.findById(classId),
        Subject.findById(subjectId),
        User.findById(teacherId),
      ]);

      if (!cls || !subject || !teacher)
        return res.status(404).json({ message: "Invalid class/subject/teacher" });

      /** Subject belongs to class + section */
      if (
        subject.class.toString() !== classId.toString() ||
        (subject.sectionId &&
          subject.sectionId.toString() !== sectionId.toString())
      ) {
        return res.status(400).json({
          message: "Subject does not belong to class/section",
        });
      }

      /** Teacher time clash */
      const teacherClash = await ExamSchedule.find({
        school,
        teacherId,
        day,
        type,
        year,
      });

      for (const t of teacherClash) {
        if (isOverlap(startTime, endTime, t.startTime, t.endTime)) {
          return res.status(400).json({
            message: "Teacher exam time conflict",
            conflict: t,
          });
        }
      }

      /** Class + section time clash */
      const classClash = await ExamSchedule.find({
        school,
        classId,
        sectionId,
        day,
        type,
        year,
      });

      for (const c of classClash) {
        if (isOverlap(startTime, endTime, c.startTime, c.endTime)) {
          return res.status(400).json({
            message: "Class exam time conflict",
            conflict: c,
          });
        }
      }

      /** Subject once per exam */
      const subjectExists = await ExamSchedule.findOne({
        school,
        classId,
        sectionId,
        subjectId,
        type,
        year,
      });

      if (subjectExists) {
        return res.status(400).json({
          message: "Subject already scheduled for this exam",
        });
      }

      const exam = await ExamSchedule.create({
        school,
        classId,
        sectionId,
        subjectId,
        teacherId,
        day,
        startTime,
        endTime,
        type,
        year,
      });

      created.push(exam);
    }

    res.status(201).json({
      message: "Exam schedules created successfully",
      count: created.length,
      schedules: created,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// GET ADMIN
const getSchedule = async (req, res) => {
  try {
    let { page = 1, limit = 10, classId, sectionId, type, year } = req.query;
    page = Number(page);
    limit = Number(limit);

    const filter = { school: req.user.school };
    if (classId) filter.classId = classId;
    if (sectionId) filter.sectionId = sectionId;
    if (type) filter.type = type;
    if (year) filter.year = year;

    const total = await ExamSchedule.countDocuments(filter);

    const data = await ExamSchedule.find(filter)
      .populate("classId", "class sections")
      .populate("subjectId", "name code")
      .populate("teacherId", "name email")
      .sort({ day: 1, startTime: 1 })
      .skip((page - 1) * limit)
      .limit(limit);

    const formatted = data.map((d) => ({
      _id: d._id,
      class: d.classId.class,
      section: extractSection(d.classId, d.sectionId),
      subject: d.subjectId,
      teacher: d.teacherId,
      day: d.day,
      startTime: d.startTime,
      endTime: d.endTime,
      type: d.type,
      year: d.year,
    }));

    res.json({
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      schedule: formatted,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// GET BY TEACHER
const getScheduleByTeacher = async (req, res) => {
  try {
    let { page = 1, limit = 10 } = req.query;
    page = Number(page);
    limit = Number(limit);

    const filter = { teacherId: req.user._id };

    const total = await ExamSchedule.countDocuments(filter);

    const data = await ExamSchedule.find(filter)
      .populate("classId", "class sections")
      .populate("subjectId", "name code")
      .skip((page - 1) * limit)
      .limit(limit)
      .sort({ day: 1, startTime: 1 });

    const formatted = data.map((d) => ({
      _id: d._id,
      class: {
        _id: d.classId._id,
        name: d.classId.class,
      },
      section: extractSection(d.classId, d.sectionId),
      subject: {
        _id: d.subjectId._id,
        name: d.subjectId.name,
        code: d.subjectId.code,
      },
      day: d.day,
      startTime: d.startTime,
      endTime: d.endTime,
      type: d.type,
      year: d.year,
    }));

    res.status(200).json({
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      schedule: formatted,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// GET BY STUDENT 
const getScheduleByStudent = async (req, res) => {
  try {
    const student = req.user;

    let { page = 1, limit = 10 } = req.query;
    page = Number(page);
    limit = Number(limit);

    const filter = {
      school: student.school,
      classId: student.classInfo.id,
      sectionId: student.sectionInfo.id,
    };

    const total = await ExamSchedule.countDocuments(filter);

    const data = await ExamSchedule.find(filter)
      .populate("classId", "class sections")
      .populate("subjectId", "name code")
      .populate("teacherId", "name email")
      .skip((page - 1) * limit)
      .limit(limit)
      .sort({ day: 1, startTime: 1 });

    const formatted = data.map((d) => ({
      _id: d._id,
      class: {
        _id: d.classId._id,
        name: d.classId.class,
      },
      section: extractSection(d.classId, d.sectionId),
      subject: {
        _id: d.subjectId._id,
        name: d.subjectId.name,
        code: d.subjectId.code,
      },
      teacher: {
        _id: d.teacherId._id,
        name: d.teacherId.name,
        email: d.teacherId.email,
      },
      day: d.day,
      startTime: d.startTime,
      endTime: d.endTime,
      type: d.type,
      year: d.year,
    }));

    res.status(200).json({
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      schedule: formatted,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// UPDATE EXAM SCHEDULE
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

// DELETE EXAM SCHEDULE
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
