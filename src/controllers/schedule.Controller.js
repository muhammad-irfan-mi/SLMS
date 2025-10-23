// const Schedule = require("../models/Schedule");
// const Subject = require("../models/Subject");

// function isTimeOverlap(start1, end1, start2, end2) {
//   const toMinutes = (t) => {
//     const [h, m] = t.split(":").map(Number);
//     return h * 60 + m;
//   };
//   const s1 = toMinutes(start1), e1 = toMinutes(end1);
//   const s2 = toMinutes(start2), e2 = toMinutes(end2);
//   return s1 < e2 && s2 < e1;
// }

// const addSchedule = async (req, res) => {
//   try {
//     const { classId, sectionIds, day, type, subjectId, startTime, endTime } = req.body;
//     const schoolId = req.user.school;

//     if (!classId || !day || !startTime || !endTime || !type)
//       return res.status(400).json({ message: "Required fields missing" });

//     if (!Array.isArray(sectionIds) || sectionIds.length === 0)
//       return res.status(400).json({ message: "At least one section is required" });

//     if (type === "subject" && !subjectId)
//       return res.status(400).json({ message: "Subject ID required for subject schedule" });

//     if (subjectId) {
//       const subject = await Subject.findById(subjectId);
//       if (!subject) return res.status(404).json({ message: "Subject not found" });
//     }

//     const results = [];

//     for (const sectionId of sectionIds) {
//       const existingSchedules = await Schedule.find({
//         school: schoolId,
//         classId,
//         sectionId,
//         day,
//       });

//       // Remove overlaps
//       for (const s of existingSchedules) {
//         if (isTimeOverlap(startTime, endTime, s.startTime, s.endTime)) {
//           console.log(`🧹 Removing overlapping schedule for section ${sectionId}: ${s._id}`);
//           await Schedule.findByIdAndDelete(s._id);
//         }
//       }

//       const newSchedule = await Schedule.create({
//         school: schoolId,
//         classId,
//         sectionId,
//         day,
//         type,
//         subjectId,
//         startTime,
//         endTime,
//       });

//       results.push(newSchedule);
//     }

//     return res.status(201).json({
//       message: "Schedules added successfully for multiple sections",
//       created: results,
//     });
//   } catch (error) {
//     console.error("Error adding schedule:", error);
//     res.status(500).json({ message: "Internal server error", error: error.message });
//   }
// };


// const getSchedule = async (req, res) => {
//   try {
//     const { classId, sectionId, day } = req.query;
//     const schoolId = req.user.school;

//     const filter = { school: schoolId };
//     if (classId) filter.classId = classId;
//     if (sectionId) filter.sectionId = sectionId;
//     if (day) filter.day = day;

//     const schedule = await Schedule.find(filter)
//       .populate("subjectId", "name code")
//       .populate("classId", "class")
//       .populate("sectionId", "name");

//     res.status(200).json({ schedule });
//   } catch (error) {
//     console.error(error);
//     res.status(500).json({ message: "Internal server error" });
//   }
// };

// const updateSchedule = async (req, res) => {
//   try {
//     const { id } = req.params;
//     const updated = await Schedule.findByIdAndUpdate(id, req.body, { new: true });
//     if (!updated) return res.status(404).json({ message: "Schedule not found" });
//     res.status(200).json({ message: "Schedule updated", schedule: updated });
//   } catch (err) {
//     res.status(500).json({ message: "Server error", error: err.message });
//   }
// };

// const deleteSchedule = async (req, res) => {
//   try {
//     const { id } = req.params;
//     const deleted = await Schedule.findByIdAndDelete(id);
//     if (!deleted) return res.status(404).json({ message: "Schedule not found" });
//     res.status(200).json({ message: "Schedule deleted" });
//   } catch (err) {
//     res.status(500).json({ message: "Server error", error: err.message });
//   }
// };

// module.exports = { addSchedule, getSchedule, updateSchedule, deleteSchedule };






























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
    const { classId, sectionIds, day, type, subjectId, startTime, endTime, teacherId } = req.body;
    const schoolId = req.user.school;

    if (!classId || !day || !startTime || !endTime || !type) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    if (!Array.isArray(sectionIds) || sectionIds.length === 0) {
      return res.status(400).json({ message: "At least one section required" });
    }

    if (type === "subject" && (!subjectId || !teacherId)) {
      return res.status(400).json({ message: "Subject and Teacher are required for subject schedule" });
    }

    const classExists = await ClassSection.findById(classId);
    if (!classExists) return res.status(404).json({ message: "Class not found" });

    if (subjectId) {
      const subjectExists = await Subject.findById(subjectId);
      if (!subjectExists) return res.status(404).json({ message: "Subject not found" });
    }

    if (teacherId) {
      const teacherExists = await User.findById(teacherId);
      if (!teacherExists) return res.status(404).json({ message: "Teacher not found" });
    }

    const results = [];

    for (const sectionId of sectionIds) {
      const existing = await Schedule.find({
        school: schoolId,
        classId,
        sectionId,
        day,
      });

      for (const s of existing) {
        if (isTimeOverlap(startTime, endTime, s.startTime, s.endTime)) {
          console.log(`Removing overlapping schedule: ${s._id}`);
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

      results.push(newSchedule);
    }

    return res.status(201).json({
      message: "Schedules added successfully",
      count: results.length,
      schedules: results,
    });
  } catch (error) {
    console.error("Add schedule error:", error);
    return res.status(500).json({ message: "Internal server error", error: error.message });
  }
};

// Get schedules
const getSchedule = async (req, res) => {
  try {
    const { classId, sectionId, teacherId, day } = req.query;
    const schoolId = req.user.school;

    const filter = { school: schoolId };
    if (classId) filter.classId = classId;
    if (sectionId) filter.sectionId = sectionId;
    if (teacherId) filter.teacherId = teacherId;
    if (day) filter.day = day;

    const schedule = await Schedule.find(filter)
      .populate("subjectId", "name code")
      .populate("teacherId", "name email")
      .populate("classId", "class");

    // ✅ Manually attach section name from ClassSection
    const formatted = [];
    for (const item of schedule) {
      const classDoc = await ClassSection.findById(item.classId);
      let sectionName = null;

      if (classDoc && classDoc.sections) {
        const sec = classDoc.sections.id(item.sectionId);
        if (sec) sectionName = sec.name;
      }

      formatted.push({
        ...item.toObject(),
        sectionName: sectionName || "Unknown",
      });
    }

    res.status(200).json({
      total: formatted.length,
      schedule: formatted,
    });
  } catch (error) {
    console.error("Get schedule error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Get all schedules assigned to logged-in teacher
const getScheduleByTeacher = async (req, res) => {
  try {
    const teacherId = req.user._id;
    const schedule = await Schedule.find({ teacherId })
      .populate("classId", "class")
      .populate("sectionId", "name")
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

    if (student.role !== "student") {
      return res.status(403).json({ message: "Access denied: Student only" });
    }

    const classId = student.classId || student.classInfo?.id;
    const sectionId = student.sectionId || student.sectionInfo?.id;

    if (!classId || !sectionId) {
      return res.status(400).json({ message: "Student is not assigned to a class or section" });
    }

    const schedule = await Schedule.find({
      classId,
      sectionId,
      school: student.school,
    })
      .populate("subjectId", "name code")
      .populate("teacherId", "name email")
      .populate("classId", "class");


    return res.status(200).json({
      total: schedule.length,
      schedule,
    });
  } catch (error) {
    console.error("Get student schedule error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Update existing schedule
const updateSchedule = async (req, res) => {
  try {
    const { id } = req.params;
    const updated = await Schedule.findByIdAndUpdate(id, req.body, { new: true });
    if (!updated) return res.status(404).json({ message: "Schedule not found" });

    res.status(200).json({ message: "Schedule updated successfully", schedule: updated });
  } catch (error) {
    console.error("Update schedule error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Delete schedule by ID
const deleteSchedule = async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await Schedule.findByIdAndDelete(id);
    if (!deleted) return res.status(404).json({ message: "Schedule not found" });

    res.status(200).json({ message: "Schedule deleted successfully" });
  } catch (error) {
    console.error("Delete schedule error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
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
