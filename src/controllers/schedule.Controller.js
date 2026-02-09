const Schedule = require("../models/Schedule");
const Subject = require("../models/Subject");
const ClassSection = require("../models/ClassSection");
const User = require("../models/User");
const { getClassSectionData } = require("../utils/classHelper");

const timeToMinutes = (time) => {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
};

const normalizeRange = (start, end) => {
  let s = timeToMinutes(start);
  let e = timeToMinutes(end);

  if (e <= s) {
    e += 24 * 60;
  }

  return { start: s, end: e };
};

const isOverlap = (s1, e1, s2, e2) => {
  return s1 < e2 && s2 < e1;
};


// const formatScheduleResponse = (schedule) => {
//   const response = schedule.toObject ? schedule.toObject() : { ...schedule };

//   if (response.classId) {
//     if (typeof response.classId === 'object') {
//       response.classInfo = {
//         _id: response.classId._id,
//         name: response.classId.class || response.classId.name
//       };
//       delete response.classId;
//     }
//   }

//   if (response.sectionId && schedule.classId && schedule.classId.sections) {
//     const foundSection = schedule.classId.sections.find(
//       section => section._id.toString() === response.sectionId.toString()
//     );
//     if (foundSection) {
//       response.sectionInfo = {
//         _id: foundSection._id,
//         name: foundSection.name
//       };
//     }
//   }

//   if (response.subjectId) {
//     if (typeof response.subjectId === 'object') {
//       response.subjectInfo = {
//         _id: response.subjectId._id,
//         name: response.subjectId.name,
//         code: response.subjectId.code
//       };
//     }
//     delete response.subjectId;
//   }

//   if (response.teacherId) {
//     if (typeof response.teacherId === 'object') {
//       response.teacherInfo = {
//         _id: response.teacherId._id,
//         name: response.teacherId.name,
//         email: response.teacherId.email
//       };
//     }
//     delete response.teacherId;
//   }

//   return response;
// };

// Add new schedule

const formatScheduleResponse = (schedule) => {
  const response = schedule?.toObject
    ? schedule.toObject()
    : { ...schedule };

  /* ---------- CLASS ---------- */
  if (response.classId && typeof response.classId === "object") {
    response.classInfo = {
      _id: response.classId._id,
      name: response.classId.class || response.classId.name
    };
  }

  /* ---------- SECTION ---------- */
  if (
    response.sectionId &&
    response.classId &&
    Array.isArray(response.classId.sections)
  ) {
    const foundSection = response.classId.sections.find(
      sec => sec._id.toString() === response.sectionId.toString()
    );

    if (foundSection) {
      response.sectionInfo = {
        _id: foundSection._id,
        name: foundSection.name
      };
    }
  }

  /* ---------- SUBJECT ---------- */
  if (response.subjectId && typeof response.subjectId === "object") {
    response.subjectInfo = {
      _id: response.subjectId._id,
      name: response.subjectId.name,
      code: response.subjectId.code
    };
  }

  /* ---------- TEACHER ---------- */
  if (response.teacherId && typeof response.teacherId === "object") {
    response.teacherInfo = {
      _id: response.teacherId._id,
      name: response.teacherId.name,
      email: response.teacherId.email
    };
  }

  /* ---------- CLEANUP ---------- */
  delete response.classId;
  delete response.sectionId;
  delete response.subjectId;
  delete response.teacherId;

  return response;
};

const addSchedule = async (req, res) => {
  try {
    const schoolId = req.user.school || req.user._id;
    const { schedules } = req.body;

    const schedulesInRequest = [];

    for (let i = 0; i < schedules.length; i++) {
      const s = schedules[i];

      const classResult = await getClassSectionData(s.classId, schoolId);
      if (classResult.error) {
        return res.status(400).json({ message: classResult.error.message });
      }

      const classSections = classResult.classDoc.sections.map(sec =>
        sec._id.toString()
      );

      for (const secId of s.sectionIds) {
        if (!classSections.includes(secId.toString())) {
          return res.status(400).json({
            message: `Section ${secId} not found in class`
          });
        }
      }

      if (s.type === 'subject') {
        const subject = await Subject.findOne({ _id: s.subjectId, school: schoolId });
        if (!subject) return res.status(400).json({ message: "Subject not found" });

        const teacher = await User.findOne({
          _id: s.teacherId,
          school: schoolId,
          role: 'teacher'
        });
        if (!teacher) return res.status(400).json({ message: "Teacher not found" });
      }

      schedulesInRequest.push({ ...s, index: i });
    }

    for (const current of schedulesInRequest) {
      const incoming = normalizeRange(current.startTime, current.endTime);

      for (const sectionId of current.sectionIds) {

        if (current.teacherId) {
          const teacherSchedules = await Schedule.find({
            school: schoolId,
            teacherId: current.teacherId,
            day: current.day,
            isActive: true
          });

          for (const sch of teacherSchedules) {
            const existing = normalizeRange(sch.startTime, sch.endTime);

            if (isOverlap(incoming.start, incoming.end, existing.start, existing.end)) {
              return res.status(400).json({
                message: `Teacher already busy from ${sch.startTime} to ${sch.endTime}`
              });
            }
          }
        }

        const classSchedules = await Schedule.find({
          school: schoolId,
          classId: current.classId,
          sectionId,
          day: current.day,
          isActive: true
        });

        for (const sch of classSchedules) {
          const existing = normalizeRange(sch.startTime, sch.endTime);

          if (isOverlap(incoming.start, incoming.end, existing.start, existing.end)) {
            return res.status(400).json({
              message: `Class already has schedule ${sch.startTime} to ${sch.endTime}`
            });
          }
        }

        for (const other of schedulesInRequest) {
          if (other.index === current.index) continue;
          if (other.day !== current.day) continue;

          const otherRange = normalizeRange(other.startTime, other.endTime);

          if (
            current.teacherId &&
            other.teacherId &&
            current.teacherId === other.teacherId &&
            isOverlap(incoming.start, incoming.end, otherRange.start, otherRange.end)
          ) {
            return res.status(400).json({
              message: `Teacher conflict with ${other.startTime} - ${other.endTime}`
            });
          }

          if (
            current.classId === other.classId &&
            other.sectionIds.includes(sectionId) &&
            isOverlap(incoming.start, incoming.end, otherRange.start, otherRange.end)
          ) {
            return res.status(400).json({
              message: `Class conflict with ${other.startTime} - ${other.endTime}`
            });
          }
        }
      }
    }

    const created = [];

    for (const s of schedules) {
      for (const sectionId of s.sectionIds) {
        created.push(await Schedule.create({
          school: schoolId,
          classId: s.classId,
          sectionId,
          subjectId: s.type === 'subject' ? s.subjectId : null,
          teacherId: s.type === 'subject' ? s.teacherId : null,
          day: s.day,
          type: s.type,
          startTime: s.startTime,
          endTime: s.endTime
        }));
      }
    }

    res.status(201).json({
      message: "All schedules created successfully",
      total: created.length,
      schedules: created
    });

  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// Get schedules for admin/office
const getSchedule = async (req, res) => {
  try {
    const schoolId = req.user.school;
    let { page = 1, limit = 10, classId, sectionId, teacherId, day } = req.query;

    page = Number(page);
    limit = Number(limit);

    const filter = { school: schoolId, isActive: true };
    if (classId) filter.classId = classId;
    if (sectionId) filter.sectionId = sectionId;
    if (teacherId) filter.teacherId = teacherId;
    if (day) filter.day = day;

    const total = await Schedule.countDocuments(filter);

    const schedules = await Schedule.find(filter)
      // .populate("subjectId", "name code")
      .populate({
        path: "subjectId",
        select: "name code",
        match: { isActive: true }
      })
      .populate("teacherId", "name email")
      .populate("classId", "class sections")
      .skip((page - 1) * limit)
      .limit(limit)
      .sort({ day: 1, startTime: 1 });

    const validSchedules = schedules.filter(schedule =>
      schedule.type !== 'subject' || schedule.subjectId !== null
    );

    const formattedSchedules = validSchedules.map(schedule =>
      formatScheduleResponse(schedule)
    );

    res.status(200).json({
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      count: formattedSchedules.length,
      schedules: formattedSchedules,
    });
  } catch (error) {
    console.error("Get schedule error:", error);
    res.status(500).json({
      message: "Server error",
      error: error.message
    });
  }
};

// Get schedule by specific section
const getScheduleBySection = async (req, res) => {
  try {
    const schoolId = req.user.school;
    const { classId, sectionId, day, page = 1, limit = 10 } = req.query;

    const classResult = await getClassSectionData(classId, schoolId, sectionId);
    if (classResult.error) {
      return res.status(classResult.error.status).json({
        message: classResult.error.message
      });
    }

    const filter = {
      school: schoolId,
      classId,
      sectionId,
      isActive: true
    };
    if (day) filter.day = day;

    const total = await Schedule.countDocuments(filter);

    const schedules = await Schedule.find(filter)
      .populate({
        path: "subjectId",
        select: "name code",
        match: { isActive: true }
      })
      .populate("teacherId", "name email")
      .populate("classId", "class sections")
      .skip((page - 1) * limit)
      .limit(limit)
      .sort({ day: 1, startTime: 1 });

    const validSchedules = schedules.filter(schedule =>
      schedule.type !== 'subject' || schedule.subjectId !== null
    );

    const formattedSchedules = validSchedules.map(schedule =>
      formatScheduleResponse(schedule)
    );

    res.status(200).json({
      page: Number(page),
      limit: Number(limit),
      total,
      totalPages: Math.ceil(total / limit),
      count: formattedSchedules.length,
      class: classResult.data.class,
      section: classResult.data.section,
      schedules: formattedSchedules,
    });
  } catch (error) {
    console.error("Get schedule by section error:", error);
    res.status(500).json({
      message: "Server error",
      error: error.message
    });
  }
};

// Get all schedules assigned to logged-in teacher
const getScheduleByTeacher = async (req, res) => {
  try {
    const teacherId = req.user._id;
    const schoolId = req.user.school;
    let { page = 1, limit = 10, day } = req.query;

    page = Number(page);
    limit = Number(limit);

    const filter = {
      school: schoolId,
      teacherId,
      isActive: true
    };
    if (day) filter.day = day;

    const total = await Schedule.countDocuments(filter);

    const schedules = await Schedule.find(filter)
      .populate({
        path: "subjectId",
        select: "name code",
        match: { isActive: true }
      })
      .populate("teacherId", "name email")
      .populate("classId", "class sections")
      .skip((page - 1) * limit)
      .limit(limit)
      .sort({ day: 1, startTime: 1 });

    const validSchedules = schedules.filter(schedule =>
      schedule.type !== 'subject' || schedule.subjectId !== null
    );

    const formattedSchedules = validSchedules.map(schedule => {
      const formatted = formatScheduleResponse(schedule);
      console.log(formatted)
      return {
        _id: formatted._id,
        classInfo: formatted.classInfo,
        sectionInfo: formatted.sectionInfo,
        subjectInfo: formatted.subjectInfo,
        teacherInfo: formatted.teacherInfo,
        day: formatted.day,
        type: formatted.type,
        startTime: formatted.startTime,
        endTime: formatted.endTime,
        createdAt: formatted.createdAt,
        updatedAt: formatted.updatedAt,
      };
    });

    res.status(200).json({
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      count: formattedSchedules.length,
      schedules: formattedSchedules,
    });
  } catch (error) {
    res.status(500).json({
      message: "Server error",
      error: error.message
    });
  }
};

// Get schedule for student
const getScheduleByStudent = async (req, res) => {
  try {
    const student = req.user;
    const schoolId = student.school;
    let { page = 1, limit = 10, day } = req.query;

    if (!student.classInfo?.id || !student.sectionInfo?.id) {
      return res.status(400).json({
        message: "Student is not assigned to any class or section"
      });
    }

    page = Number(page);
    limit = Number(limit);

    const filter = {
      school: schoolId,
      classId: student.classInfo.id,
      sectionId: student.sectionInfo.id,
      isActive: true
    };
    if (day) filter.day = day;

    const total = await Schedule.countDocuments(filter);

    const schedules = await Schedule.find(filter)
      .populate({
        path: "subjectId",
        select: "name code",
        match: { isActive: true }
      })
      .populate("teacherId", "name email")
      .populate("classId", "class sections")
      .skip((page - 1) * limit)
      .limit(limit)
      .sort({ day: 1, startTime: 1 });

    const validSchedules = schedules.filter(schedule =>
      schedule.type !== 'subject' || schedule.subjectId !== null
    );

    const formattedSchedules = validSchedules.map(schedule => {
      const formatted = formatScheduleResponse(schedule);
      return {
        _id: formatted._id,
        classInfo: formatted.classInfo,
        sectionInfo: formatted.sectionInfo,
        subjectInfo: formatted.subjectInfo,
        teacherInfo: formatted.teacherInfo,
        day: formatted.day,
        type: formatted.type,
        startTime: formatted.startTime,
        endTime: formatted.endTime,
        createdAt: formatted.createdAt,
        updatedAt: formatted.updatedAt,
      };
    });

    res.status(200).json({
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      count: formattedSchedules.length,
      schedules: formattedSchedules,
    });
  } catch (error) {
    console.error("Student schedule error:", error);
    res.status(500).json({
      message: "Server error",
      error: error.message
    });
  }
};

// Update existing schedule
const updateSchedule = async (req, res) => {
  try {
    const { id } = req.params;
    const schoolId = req.user.school;
    const updateData = req.body;

    const schedule = await Schedule.findOne({
      _id: id,
      school: schoolId
    });

    if (!schedule) {
      return res.status(404).json({
        message: "Schedule not found in your school"
      });
    }

    if (updateData.classId && updateData.classId !== schedule.classId.toString()) {
      const classResult = await getClassSectionData(updateData.classId, schoolId);
      if (classResult.error) {
        return res.status(classResult.error.status).json({
          message: classResult.error.message
        });
      }
    }

    if (updateData.sectionId) {
      const classId = updateData.classId || schedule.classId;
      const classResult = await getClassSectionData(classId, schoolId, updateData.sectionId);
      if (classResult.error) {
        return res.status(classResult.error.status).json({
          message: classResult.error.message
        });
      }
    }

    // Update the schedule
    const updatedSchedule = await Schedule.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    )
      .populate("subjectId", "name code")
      .populate("teacherId", "name email")
      .populate("classId", "class sections");

    const formattedSchedule = formatScheduleResponse(updatedSchedule);

    res.status(200).json({
      message: "Schedule updated successfully",
      schedule: formattedSchedule,
    });
  } catch (error) {
    console.error("Update schedule error:", error);
    res.status(500).json({
      message: "Server error",
      error: error.message
    });
  }
};

// Delete schedule by ID
const deleteSchedule = async (req, res) => {
  try {
    const { id } = req.params;
    const schoolId = req.user.school;

    const schedule = await Schedule.findOne({
      _id: id,
      school: schoolId,
      isActive: true
    });

    if (!schedule) {
      return res.status(404).json({
        message: "Schedule already deleted"
      });
    }

    schedule.isActive = false;
    await schedule.save();

    res.status(200).json({
      message: "Schedule deleted successfully"
    });
  } catch (error) {
    res.status(500).json({
      message: "Server error",
      error: error.message
    });
  }
};

module.exports = {
  addSchedule,
  getSchedule,
  getScheduleBySection,
  getScheduleByTeacher,
  getScheduleByStudent,
  updateSchedule,
  deleteSchedule,
};