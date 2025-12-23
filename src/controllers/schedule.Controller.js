const Schedule = require("../models/Schedule");
const Subject = require("../models/Subject");
const ClassSection = require("../models/ClassSection");
const User = require("../models/User");

// Helper function to check time overlap
function isTimeOverlap(start1, end1, start2, end2) {
  const toMinutes = (t) => {
    const [h, m] = t.split(":").map(Number);
    return h * 60 + m;
  };
  const s1 = toMinutes(start1), e1 = toMinutes(end1);
  const s2 = toMinutes(start2), e2 = toMinutes(end2);
  return s1 < e2 && s2 < e1;
}

// Add new schedule
const addSchedule = async (req, res) => {
  try {
    const schoolId = req.user.school;
    const { schedules } = req.body;

    if (!Array.isArray(schedules) || schedules.length === 0) {
      return res.status(400).json({ message: "Schedules array is required" });
    }

    const createdSchedules = [];

    for (let i = 0; i < schedules.length; i++) {
      const {
        classId,
        sectionIds,
        day,
        type,
        subjectId,
        startTime,
        endTime,
        teacherId,
      } = schedules[i];

      if (!classId || !day || !startTime || !endTime || !type) {
        return res.status(400).json({
          message: `Missing required fields in schedule index ${i}`,
        });
      }

      if (!Array.isArray(sectionIds) || sectionIds.length === 0) {
        return res.status(400).json({
          message: `At least one section is required in schedule index ${i}`,
        });
      }

      if (type === "subject" && (!subjectId || !teacherId)) {
        return res.status(400).json({
          message: `Subject and teacher are required for subject schedule at index ${i}`,
        });
      }

      const classDoc = await ClassSection.findById(classId);
      if (!classDoc) {
        return res.status(404).json({
          message: `Class not found at schedule index ${i}`,
        });
      }

      const classSectionIds = classDoc.sections.map((s) => s._id.toString());

      for (const secId of sectionIds) {
        if (!classSectionIds.includes(secId.toString())) {
          return res.status(400).json({
            message: `Section ${secId} does not belong to class ${classDoc.class} (index ${i})`,
          });
        }
      }

      if (subjectId) {
        const subjectExists = await Subject.findById(subjectId);
        if (!subjectExists) {
          return res.status(404).json({
            message: `Subject not found at schedule index ${i}`,
          });
        }
      }

      if (teacherId) {
        const teacherExists = await User.findById(teacherId);
        if (!teacherExists) {
          return res.status(404).json({
            message: `Teacher not found at schedule index ${i}`,
          });
        }
      }

      for (const sectionId of sectionIds) {
        const existing = await Schedule.find({
          school: schoolId,
          classId,
          sectionId,
          day,
        });

        for (const s of existing) {
          if (isTimeOverlap(startTime, endTime, s.startTime, s.endTime)) {
            await Schedule.findByIdAndDelete(s._id);
          }
        }

        const newSchedule = await Schedule.create({
          school: schoolId,
          classId,
          sectionId,
          subjectId,
          teacherId,
          day,
          type,
          startTime,
          endTime,
        });

        createdSchedules.push(newSchedule);
      }
    }

    return res.status(201).json({
      message: "Schedules created successfully",
      total: createdSchedules.length,
      schedules: createdSchedules,
    });
  } catch (error) {
    console.error("Add multiple schedule error:", error);
    return res.status(500).json({
      message: "Internal server error",
      error: error.message,
    });
  }
};

// Get schedules
const getSchedule = async (req, res) => {
  try {
    const schoolId = req.user.school;
    let { page = 1, limit = 10, classId, sectionId, teacherId, day } = req.query;

    page = Number(page);
    limit = Number(limit);

    const filter = { school: schoolId };
    if (classId) filter.classId = classId;
    if (sectionId) filter.sectionId = sectionId;
    if (teacherId) filter.teacherId = teacherId;
    if (day) filter.day = day;

    const total = await Schedule.countDocuments(filter);

    const data = await Schedule.find(filter)
      .populate("subjectId", "name code")
      .populate("teacherId", "name email")
      .populate("classId", "class sections")
      .skip((page - 1) * limit)
      .limit(limit)
      .sort({ day: 1, startTime: 1 });

    const formatted = data.map((item) => {
      let filteredSection = null;

      if (item.classId?.sections && sectionId) {
        filteredSection = item.classId.sections.find(
          (s) => s._id.toString() === item.sectionId.toString()
        );

        item.classId.sections = filteredSection ? [filteredSection] : [];
      }

      return {
        ...item.toObject(),
        section: filteredSection
          ? { _id: filteredSection._id, name: filteredSection.name }
          : null,
      };
    });

    res.status(200).json({
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      schedule: formatted,
    });
  } catch (error) {
    console.error("Get schedule error:", error);
    res.status(500).json({ message: error.message });
  }
};

// Get all schedules assigned to logged-in teacher
const getScheduleByTeacher = async (req, res) => {
  try {
    let { page = 1, limit = 10 } = req.query;
    page = Number(page);
    limit = Number(limit);

    const filter = { teacherId: req.user._id };

    const total = await Schedule.countDocuments(filter);

    const data = await Schedule.find(filter)
      .populate("subjectId", "name code")
      .populate("classId", "class sections")
      .skip((page - 1) * limit)
      .limit(limit)
      .sort({ day: 1, startTime: 1 });

    const formatted = data.map((item) => {
      let section = null;

      if (item.classId?.sections) {
        section = item.classId.sections.find(
          (s) => s._id.toString() === item.sectionId.toString()
        );

        item.classId.sections = section ? [section] : [];
      }

      return {
        _id: item._id,
        class: item.classId?.class || null,
        section: section
          ? { _id: section._id, name: section.name }
          : null,
        subject: item.subjectId,
        day: item.day,
        type: item.type,
        startTime: item.startTime,
        endTime: item.endTime,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
      };
    });

    res.status(200).json({
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      schedule: formatted,
    });
  } catch (error) {
    console.error("Teacher schedule error:", error);
    res.status(500).json({ message: error.message });
  }
};

const getScheduleByStudent = async (req, res) => {
  try {
    let { page = 1, limit = 10 } = req.query;
    page = Number(page);
    limit = Number(limit);

    const student = req.user;

    const filter = {
      school: student.school,
      classId: student.classInfo.id,
      sectionId: student.sectionInfo.id,
    };

    const total = await Schedule.countDocuments(filter);

    const data = await Schedule.find(filter)
      .populate("subjectId", "name code")
      .populate("teacherId", "name email")
      .populate("classId", "class sections")
      .skip((page - 1) * limit)
      .limit(limit)
      .sort({ day: 1, startTime: 1 });

    const formatted = data.map((item) => {
      let section = null;

      if (item.classId?.sections) {
        section = item.classId.sections.find(
          (s) => s._id.toString() === item.sectionId.toString()
        );

        item.classId.sections = section ? [section] : [];
      }

      return {
        _id: item._id,
        class: item.classId?.class || null,
        section: section
          ? { _id: section._id, name: section.name }
          : null,
        subject: item.subjectId,
        teacher: item.teacherId,
        day: item.day,
        type: item.type,
        startTime: item.startTime,
        endTime: item.endTime,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
      };
    });

    res.status(200).json({
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      schedule: formatted,
    });
  } catch (error) {
    console.error("Student schedule error:", error);
    res.status(500).json({ message: error.message });
  }
};

// Update existing schedule
const updateSchedule = async (req, res) => {
  try {
    const updated = await Schedule.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );

    if (!updated)
      return res.status(404).json({ message: "Schedule not found" });

    res.status(200).json({
      message: "Schedule updated successfully",
      schedule: updated,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Delete schedule by ID
const deleteSchedule = async (req, res) => {
  try {
    const deleted = await Schedule.findByIdAndDelete(req.params.id);
    if (!deleted)
      return res.status(404).json({ message: "Schedule not found" });

    res.status(200).json({ message: "Schedule deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  addSchedule,
  getSchedule,
  getScheduleByTeacher,
  getScheduleByStudent,
  updateSchedule,
  deleteSchedule,
};
