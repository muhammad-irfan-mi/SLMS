const Schedule = require("../models/Schedule");
const Subject = require("../models/Subject");

function isTimeOverlap(start1, end1, start2, end2) {
  const toMinutes = (t) => {
    const [h, m] = t.split(":").map(Number);
    return h * 60 + m;
  };
  const s1 = toMinutes(start1), e1 = toMinutes(end1);
  const s2 = toMinutes(start2), e2 = toMinutes(end2);
  return s1 < e2 && s2 < e1;
}

// const addSchedule = async (req, res) => {
//   try {
//     const { classId, sectionId, day, type, subjectId, startTime, endTime } = req.body;
//     const schoolId = req.user.school;

//     if (!classId || !day || !startTime || !endTime || !type)
//       return res.status(400).json({ message: "Required fields missing" });

//     if (type === "subject" && !subjectId)
//       return res.status(400).json({ message: "Subject ID required for subject schedule" });

//     if (subjectId) {
//       const subject = await Subject.findById(subjectId);
//       if (!subject) return res.status(404).json({ message: "Subject not found" });
//     }

//     const existingSchedules = await Schedule.find({
//       school: schoolId,
//       classId,
//       sectionId,
//       day,
//     });

//     for (const s of existingSchedules) {
//       if (isTimeOverlap(startTime, endTime, s.startTime, s.endTime)) {
//         console.log(`🧹 Removing overlapping schedule: ${s._id}`);
//         await Schedule.findByIdAndDelete(s._id);
//       }
//     }

//     const newSchedule = await Schedule.create({
//       school: schoolId,
//       classId,
//       sectionId,
//       day,
//       type,
//       subjectId,
//       startTime,
//       endTime,
//     });

//     return res.status(201).json({
//       message: "Schedule entry added successfully (previous overlapping entries removed)",
//       schedule: newSchedule,
//     });
//   } catch (error) {
//     console.error("Error adding schedule:", error);
//     res.status(500).json({ message: "Internal server error", error: error.message });
//   }
// };

const addSchedule = async (req, res) => {
  try {
    const { classId, sectionIds, day, type, subjectId, startTime, endTime } = req.body;
    const schoolId = req.user.school;

    if (!classId || !day || !startTime || !endTime || !type)
      return res.status(400).json({ message: "Required fields missing" });

    if (!Array.isArray(sectionIds) || sectionIds.length === 0)
      return res.status(400).json({ message: "At least one section is required" });

    if (type === "subject" && !subjectId)
      return res.status(400).json({ message: "Subject ID required for subject schedule" });

    if (subjectId) {
      const subject = await Subject.findById(subjectId);
      if (!subject) return res.status(404).json({ message: "Subject not found" });
    }

    const results = [];

    for (const sectionId of sectionIds) {
      const existingSchedules = await Schedule.find({
        school: schoolId,
        classId,
        sectionId,
        day,
      });

      // Remove overlaps
      for (const s of existingSchedules) {
        if (isTimeOverlap(startTime, endTime, s.startTime, s.endTime)) {
          console.log(`🧹 Removing overlapping schedule for section ${sectionId}: ${s._id}`);
          await Schedule.findByIdAndDelete(s._id);
        }
      }

      const newSchedule = await Schedule.create({
        school: schoolId,
        classId,
        sectionId,
        day,
        type,
        subjectId,
        startTime,
        endTime,
      });

      results.push(newSchedule);
    }

    return res.status(201).json({
      message: "Schedules added successfully for multiple sections",
      created: results,
    });
  } catch (error) {
    console.error("Error adding schedule:", error);
    res.status(500).json({ message: "Internal server error", error: error.message });
  }
};


const getSchedule = async (req, res) => {
  try {
    const { classId, sectionId, day } = req.query;
    const schoolId = req.user.school;

    const filter = { school: schoolId };
    if (classId) filter.classId = classId;
    if (sectionId) filter.sectionId = sectionId;
    if (day) filter.day = day;

    const schedule = await Schedule.find(filter)
      .populate("subjectId", "name code")
      .populate("classId", "class")
      .populate("sectionId", "name");

    res.status(200).json({ schedule });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal server error" });
  }
};

const updateSchedule = async (req, res) => {
  try {
    const { id } = req.params;
    const updated = await Schedule.findByIdAndUpdate(id, req.body, { new: true });
    if (!updated) return res.status(404).json({ message: "Schedule not found" });
    res.status(200).json({ message: "Schedule updated", schedule: updated });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

const deleteSchedule = async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await Schedule.findByIdAndDelete(id);
    if (!deleted) return res.status(404).json({ message: "Schedule not found" });
    res.status(200).json({ message: "Schedule deleted" });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

module.exports = { addSchedule, getSchedule, updateSchedule, deleteSchedule };
