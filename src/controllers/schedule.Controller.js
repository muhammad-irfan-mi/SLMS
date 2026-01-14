const Schedule = require("../models/Schedule");
const Subject = require("../models/Subject");
const ClassSection = require("../models/ClassSection");
const User = require("../models/User");
const { getClassSectionData } = require("../utils/classHelper");

// Helper function to check time overlap
const isTimeOverlap = (start1, end1, start2, end2) => {
  const toMinutes = (t) => {
    const [h, m] = t.split(":").map(Number);
    return h * 60 + m;
  };
  const s1 = toMinutes(start1), e1 = toMinutes(end1);
  const s2 = toMinutes(start2), e2 = toMinutes(end2);
  return s1 < e2 && s2 < e1;
};

// Helper function to format schedule response
const formatScheduleResponse = (schedule) => {
  const response = schedule.toObject ? schedule.toObject() : { ...schedule };

  if (response.classId) {
    if (typeof response.classId === 'object') {
      response.class = {
        _id: response.classId._id,
        name: response.classId.class || response.classId.name
      };
      delete response.classId;
    }
  }

  if (response.sectionId && schedule.classId && schedule.classId.sections) {
    const foundSection = schedule.classId.sections.find(
      section => section._id.toString() === response.sectionId.toString()
    );
    if (foundSection) {
      response.section = {
        _id: foundSection._id,
        name: foundSection.name
      };
    }
  }

  if (response.subjectId) {
    if (typeof response.subjectId === 'object') {
      response.subject = {
        _id: response.subjectId._id,
        name: response.subjectId.name,
        code: response.subjectId.code
      };
    }
    delete response.subjectId;
  }

  if (response.teacherId) {
    if (typeof response.teacherId === 'object') {
      response.teacher = {
        _id: response.teacherId._id,
        name: response.teacherId.name,
        email: response.teacherId.email
      };
    }
    delete response.teacherId;
  }

  return response;
};

// Add new schedule
const addSchedule = async (req, res) => {
  try {
    console.log(req.user)
    const schoolId = req.user.school || req.user._id;
    console.log("schoolId", schoolId)
    const { schedules } = req.body;

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

      const classResult = await getClassSectionData(classId, schoolId);
      if (classResult.error) {
        return res.status(classResult.error.status).json({
          message: classResult.error.message
        });
      }

      const classSectionIds = classResult.classDoc.sections.map(s => s._id.toString());
      for (const secId of sectionIds) {
        if (!classSectionIds.includes(secId.toString())) {
          return res.status(400).json({
            message: `Section ${secId} does not belong to class ${classResult.data.class.name}`,
          });
        }
      }

      // Validate subject exists and belongs to school if provided
      if (subjectId && type === 'subject') {
        const subject = await Subject.findOne({
          _id: subjectId,
          school: schoolId
        });

        if (!subject) {
          return res.status(400).json({
            message: `Subject not found in your school`,
          });
        }
      }

      // Validate teacher exists and belongs to school if provided
      if (teacherId && type === 'subject') {
        const teacher = await User.findOne({
          _id: teacherId,
          school: schoolId,
          role: 'teacher'
        });

        if (!teacher) {
          return res.status(400).json({
            message: `Teacher not found in your school`,
          });
        }
      }

      // Create schedule for each section
      for (const sectionId of sectionIds) {
        // Check for time overlaps and delete overlapping schedules
        const existingSchedules = await Schedule.find({
          school: schoolId,
          classId,
          sectionId,
          day,
        });

        for (const existing of existingSchedules) {
          if (isTimeOverlap(startTime, endTime, existing.startTime, existing.endTime)) {
            await Schedule.findByIdAndDelete(existing._id);
          }
        }

        const newSchedule = await Schedule.create({
          school: schoolId,
          classId,
          sectionId,
          subjectId: type === 'subject' ? subjectId : null,
          teacherId: type === 'subject' ? teacherId : null,
          day,
          type,
          startTime,
          endTime,
        });

        const populatedSchedule = await Schedule.findById(newSchedule._id)
          .populate("subjectId", "name code")
          .populate("teacherId", "name email")
          .populate("classId", "class sections");

        createdSchedules.push(formatScheduleResponse(populatedSchedule));
      }
    }

    return res.status(201).json({
      message: "Schedules created successfully",
      total: createdSchedules.length,
      schedules: createdSchedules,
    });
  } catch (error) {
    console.error("Add schedule error:", error);
    return res.status(500).json({
      message: "Server error",
      error: error.message,
    });
  }
};

// Get schedules for admin/office
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

    const schedules = await Schedule.find(filter)
      .populate("subjectId", "name code")
      .populate("teacherId", "name email")
      .populate("classId", "class sections")
      .skip((page - 1) * limit)
      .limit(limit)
      .sort({ day: 1, startTime: 1 });

    const formattedSchedules = schedules.map(schedule =>
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
      sectionId
    };
    if (day) filter.day = day;

    const total = await Schedule.countDocuments(filter);

    const schedules = await Schedule.find(filter)
      .populate("subjectId", "name code")
      .populate("teacherId", "name email")
      .populate("classId", "class sections")
      .skip((page - 1) * limit)
      .limit(limit)
      .sort({ day: 1, startTime: 1 });

    const formattedSchedules = schedules.map(schedule =>
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
      teacherId
    };
    if (day) filter.day = day;

    const total = await Schedule.countDocuments(filter);

    const schedules = await Schedule.find(filter)
      .populate("subjectId", "name code")
      .populate("classId", "class sections")
      .skip((page - 1) * limit)
      .limit(limit)
      .sort({ day: 1, startTime: 1 });

    const formattedSchedules = schedules.map(schedule => {
      const formatted = formatScheduleResponse(schedule);
      return {
        _id: formatted._id,
        class: formatted.class,
        section: formatted.section,
        subject: formatted.subject,
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
    console.error("Teacher schedule error:", error);
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
    };
    if (day) filter.day = day;

    const total = await Schedule.countDocuments(filter);

    const schedules = await Schedule.find(filter)
      .populate("subjectId", "name code")
      .populate("teacherId", "name email")
      .populate("classId", "class sections")
      .skip((page - 1) * limit)
      .limit(limit)
      .sort({ day: 1, startTime: 1 });

    const formattedSchedules = schedules.map(schedule => {
      const formatted = formatScheduleResponse(schedule);
      return {
        _id: formatted._id,
        class: formatted.class,
        section: formatted.section,
        subject: formatted.subject,
        teacher: formatted.teacher,
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

    // If classId is being updated, validate it belongs to school
    if (updateData.classId && updateData.classId !== schedule.classId.toString()) {
      const classResult = await getClassSectionData(updateData.classId, schoolId);
      if (classResult.error) {
        return res.status(classResult.error.status).json({
          message: classResult.error.message
        });
      }
    }

    // If sectionId is being updated, validate it belongs to class
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

    const deleted = await Schedule.findOneAndDelete({
      _id: id,
      school: schoolId
    });

    if (!deleted) {
      return res.status(404).json({
        message: "Schedule not found in your school"
      });
    }

    res.status(200).json({
      message: "Schedule deleted successfully"
    });
  } catch (error) {
    console.error("Delete schedule error:", error);
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