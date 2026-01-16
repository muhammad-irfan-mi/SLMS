const ExamSchedule = require("../models/ExamSchedule");
const Subject = require("../models/Subject");
const ClassSection = require("../models/ClassSection");
const User = require("../models/User");
const Notice = require("../models/Notice");

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

const formatDate = (date) => {
  return date.toISOString().split('T')[0];
};

// Create exam schedule notification
const createExamNotification = async (schoolId, classId, sectionId, examData, createdBy, teacherId = null) => {
  try {
    const classSection = await ClassSection.findById(classId);
    if (!classSection) {
      console.error('Class not found for notification:', classId);
      return null;
    }

    const section = classSection.sections.find(s => s._id.toString() === sectionId.toString());
    const sectionName = section ? section.name : 'Unknown';

    const notificationData = {
      school: schoolId,
      title: `Exam Schedule - ${examData.type.toUpperCase()}`,
      message: `${examData.type.toUpperCase()} Exam \n` +
        `For ${examData.subjectName}` +
        ` on ${examData.examDate.toDateString()} ` +
        `at ${examData.startTime} - ${examData.endTime} ` +
        `in class ${classSection.class} and section ${sectionName} \n` +
        `Regards ${examData.teacherName || 'To be announced'}`,
      createdBy: createdBy,
      category: 'notice',
      startDate: formatDate(new Date()),
      pinned: true,
      attachments: examData.attachments || []
    };

    const notices = {
      classNotice: null,
      teacherNotice: null
    };

    if (teacherId) {
      notices.teacherNotice = await Notice.create({
        ...notificationData,
        title: `Exam Assigned - ${examData.subjectName}`,
        target: 'selected_teachers',
        targetTeacherIds: [teacherId],
        classId: classId,
        sectionId: sectionId
      });
      console.log(`Teacher notification created: ${notices.teacherNotice._id}`);
    }

    notices.classNotice = await Notice.create({
      ...notificationData,
      target: 'class',
      classId: classId,
      sectionId: sectionId
    });

    return notices;

  } catch (error) {
    return null;
  }
};

const createExamUpdateNotification = async (schoolId, classId, sectionId, examData, createdBy, teacherId = null, changes = []) => {
  try {
    const classSection = await ClassSection.findById(classId);
    if (!classSection) {
      console.error('Class not found for update notification:', classId);
      return null;
    }

    const section = classSection.sections.find(s => s._id.toString() === sectionId.toString());
    const sectionName = section ? section.name : 'Unknown';

    let changesMessage = '';
    if (changes.length > 0) {
      changesMessage = '\n\n Changes\n' + changes.join('\n');
    }

    const notificationData = {
      school: schoolId,
      title: `Exam Updated - ${examData.type.toUpperCase()}`,
      message: `${examData.type.toUpperCase()} Exam Updated\n` +
        `For ${examData.subjectName}` +
        ` on ${examData.examDate.toDateString()}` +
        ` at ${examData.startTime} - ${examData.endTime}\n` +
        ` in Class: ${classSection.class} and section ${sectionName}\n` +
        `Regards ${examData.teacherName || 'To be announced'}` +
        changesMessage,
      createdBy: createdBy,
      category: 'notice',
      startDate: formatDate(new Date()),
      pinned: true,
      attachments: examData.attachments || []
    };

    // Create notices for both teacher and class
    const notices = {
      classNotice: null,
      teacherNotice: null
    };

    // Create notice for teacher if teacherId is provided
    if (teacherId) {
      notices.teacherNotice = await Notice.create({
        ...notificationData,
        title: `📝 Exam Updated - ${examData.subjectName}`,
        target: 'selected_teachers',
        targetTeacherIds: [teacherId],
        classId: classId,
        sectionId: sectionId
      });
      console.log(`Teacher update notification: ${notices.teacherNotice._id}`);
    }

    // Create notice for class/section
    notices.classNotice = await Notice.create({
      ...notificationData,
      target: 'class',
      classId: classId,
      sectionId: sectionId
    });

    console.log(`Class update notification: ${notices.classNotice._id}`);
    return notices;

  } catch (error) {
    console.error('Error creating exam update notification:', error.message);
    return null;
  }
};

// Create exam cancellation notification
const createExamCancellationNotification = async (schoolId, classId, sectionId, examData, createdBy, teacherId = null, reason = '') => {
  try {
    const classSection = await ClassSection.findById(classId);
    if (!classSection) {
      console.error('Class not found for cancellation:', classId);
      return null;
    }

    const section = classSection.sections.find(s => s._id.toString() === sectionId.toString());
    const sectionName = section ? section.name : 'Unknown';

    let reasonMessage = '';
    if (reason) {
      reasonMessage = `\n Reason: ${reason}`;
    }

    const notificationData = {
      school: schoolId,
      title: `Exam Cancelled - ${examData.type.toUpperCase()}`,
      message: `EXAM CANCELLED\n` +
        `For Subject: ${examData.subjectName}` +
        ` on ${examData.examDate.toDateString()}\n` +
        ` at ${examData.startTime} - ${examData.endTime}` +
        ` in class ${classSection.class} and section ${sectionName}` +
        reasonMessage,
      createdBy: createdBy,
      category: 'notice',
      startDate: formatDate(new Date()),
      pinned: true
    };

    const notices = {
      classNotice: null,
      teacherNotice: null
    };

    if (teacherId) {
      notices.teacherNotice = await Notice.create({
        ...notificationData,
        title: `Exam Cancelled - ${examData.subjectName}`,
        target: 'selected_teachers',
        targetTeacherIds: [teacherId],
        classId: classId,
        sectionId: sectionId
      });
      console.log(`Teacher cancellation notification: ${notices.teacherNotice._id}`);
    }

    notices.classNotice = await Notice.create({
      ...notificationData,
      target: 'class',
      classId: classId,
      sectionId: sectionId
    });

    return notices;

  } catch (error) {
    return null;
  }
};

// CREATE EXAM SCHEDULE
const addExamSchedule = async (req, res) => {
  try {
    const schoolId = req.user.school;
    const createdBy = req.user._id;
    const { type, year, schedules } = req.body;

    const createdSchedules = [];
    const errors = [];

    for (const item of schedules) {
      try {
        const {
          classId,
          sectionId,
          subjectId,
          teacherId,
          examDate,
          day,
          startTime,
          endTime,
        } = item;

        const examDateObj = new Date(examDate);

        const classObj = await ClassSection.findOne({
          _id: classId,
          school: schoolId
        });
        if (!classObj) {
          errors.push({ item, error: "Class not found in your school" });
          continue;
        }

        const sectionExists = classObj.sections.some(
          (sec) => sec._id.toString() === sectionId.toString()
        );
        if (!sectionExists) {
          errors.push({ item, error: "Section not found in this class" });
          continue;
        }

        const subject = await Subject.findOne({
          _id: subjectId,
          class: classId,
          $or: [
            { sectionId: sectionId },
            { sectionId: null }
          ]
        });
        if (!subject) {
          errors.push({ item, error: "Subject not found for this class/section" });
          continue;
        }

        const teacher = await User.findOne({
          _id: teacherId,
          school: schoolId,
          role: 'teacher'
        });
        if (!teacher) {
          errors.push({ item, error: "Teacher not found in your school" });
          continue;
        }

        const existingSubjectSchedule = await ExamSchedule.findOne({
          school: schoolId,
          classId,
          sectionId,
          subjectId,
          type,
          year
        });
        if (existingSubjectSchedule) {
          errors.push({
            item,
            error: `Subject already scheduled for ${type} exam in ${year}`
          });
          continue;
        }

        const teacherSchedules = await ExamSchedule.find({
          school: schoolId,
          teacherId,
          examDate: examDateObj,
          _id: { $ne: existingSubjectSchedule?._id }
        });

        let teacherConflict = false;
        for (const schedule of teacherSchedules) {
          if (isOverlap(startTime, endTime, schedule.startTime, schedule.endTime)) {
            errors.push({
              item,
              error: `Teacher has conflicting exam from ${schedule.startTime} to ${schedule.endTime}`
            });
            teacherConflict = true;
            break;
          }
        }
        if (teacherConflict) continue;

        const classSchedules = await ExamSchedule.find({
          school: schoolId,
          classId,
          sectionId,
          examDate: examDateObj,
          _id: { $ne: existingSubjectSchedule?._id }
        });

        let classConflict = false;
        for (const schedule of classSchedules) {
          if (isOverlap(startTime, endTime, schedule.startTime, schedule.endTime)) {
            errors.push({
              item,
              error: `Class has conflicting exam from ${schedule.startTime} to ${schedule.endTime}`
            });
            classConflict = true;
            break;
          }
        }
        if (classConflict) continue;

        const examSchedule = await ExamSchedule.create({
          school: schoolId,
          classId,
          sectionId,
          subjectId,
          teacherId,
          examDate: examDateObj,
          day,
          startTime,
          endTime,
          type,
          year,
          status: 'scheduled'
        });

        createdSchedules.push(examSchedule);

        await createExamNotification(
          schoolId,
          classId,
          sectionId,
          {
            subjectName: subject.name,
            examDate: examDateObj,
            startTime,
            endTime,
            type,
            teacherName: teacher.name
          },
          createdBy,
          teacherId
        );

      } catch (error) {
        errors.push({ item, error: error.message });
      }
    }

    if (createdSchedules.length === 0 && errors.length > 0) {
      return res.status(400).json({
        success: false,
        message: "Failed to create any exam schedules",
        errors: errors.map(e => e.error)
      });
    }

    res.status(201).json({
      success: true,
      message: `Successfully created ${createdSchedules.length} exam schedule(s)`,
      created: createdSchedules.length,
      errors: errors.length > 0 ? errors.map(e => e.error) : undefined,
      schedules: createdSchedules
    });

  } catch (err) {
    console.error("addExamSchedule error:", err);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

// GET EXAM SCHEDULES (ADMIN)
const getSchedule = async (req, res) => {
  try {
    const schoolId = req.user.school;
    const { classId, sectionId, subjectId, teacherId, type, year, status, startDate, endDate, page = 1, limit = 10, sortBy = 'examDate', sortOrder = 'asc' } = req.query;

    const filter = { school: schoolId };

    if (classId) filter.classId = classId;
    if (sectionId) filter.sectionId = sectionId;
    if (subjectId) filter.subjectId = subjectId;
    if (teacherId) filter.teacherId = teacherId;
    if (type) filter.type = type;
    if (year) filter.year = year;
    if (status) filter.status = status;

    if (startDate) {
      filter.examDate = { $gte: new Date(startDate) };
      if (endDate) {
        filter.examDate.$lte = new Date(endDate);
      }
    }

    const skip = (Number(page) - 1) * Number(limit);
    const sortDirection = sortOrder === 'asc' ? 1 : -1;

    const total = await ExamSchedule.countDocuments(filter);

    const schedules = await ExamSchedule.find(filter)
      .populate("classId", "class sections")
      .populate("subjectId", "name code")
      .populate("teacherId", "name email")
      .sort({ [sortBy]: sortDirection, startTime: 1 })
      .skip(skip)
      .limit(Number(limit))
      .lean();

    const formatted = schedules.map(schedule => ({
      _id: schedule._id,
      class: schedule.classId.class,
      section: extractSection(schedule.classId, schedule.sectionId),
      subject: schedule.subjectId,
      teacher: schedule.teacherId,
      examDate: schedule.examDate,
      day: schedule.day,
      startTime: schedule.startTime,
      endTime: schedule.endTime,
      type: schedule.type,
      year: schedule.year,
      status: schedule.status,
      createdAt: schedule.createdAt,
      updatedAt: schedule.updatedAt
    }));

    const totalPages = Math.ceil(total / Number(limit));

    res.json({
      success: true,
      page: Number(page),
      limit: Number(limit),
      total,
      totalPages,
      schedule: formatted,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

// GET SCHEDULE BY TEACHER
const getScheduleByTeacher = async (req, res) => {
  try {
    const teacherId = req.user._id;
    const schoolId = req.user.school;
    const {
      classId,
      sectionId,
      type,
      year,
      status,
      startDate,
      endDate,
      page = 1,
      limit = 10
    } = req.query;

    const filter = {
      school: schoolId,
      teacherId
    };

    if (classId) filter.classId = classId;
    if (sectionId) filter.sectionId = sectionId;
    if (type) filter.type = type;
    if (year) filter.year = year;
    if (status) filter.status = status;

    if (startDate) {
      filter.examDate = { $gte: new Date(startDate) };
      if (endDate) {
        filter.examDate.$lte = new Date(endDate);
      }
    }

    const skip = (Number(page) - 1) * Number(limit);

    const [total, schedules] = await Promise.all([
      ExamSchedule.countDocuments(filter),
      ExamSchedule.find(filter)
        .populate("classId", "class sections")
        .populate("subjectId", "name code")
        .populate("teacherId", "name email")
        .sort({ examDate: 1, startTime: 1 })
        .skip(skip)
        .limit(Number(limit))
        .lean()
    ]);

    const formatted = schedules.map(schedule => ({
      _id: schedule._id,
      class: {
        _id: schedule.classId._id,
        name: schedule.classId.class,
      },
      section: extractSection(schedule.classId, schedule.sectionId),
      subject: {
        _id: schedule.subjectId._id,
        name: schedule.subjectId.name,
        code: schedule.subjectId.code,
      },
      teacher: {
        _id: schedule.teacherId._id,
        name: schedule.teacherId.name,
        email: schedule.teacherId.email,
      },
      examDate: schedule.examDate,
      day: schedule.day,
      startTime: schedule.startTime,
      endTime: schedule.endTime,
      type: schedule.type,
      year: schedule.year,
      status: schedule.status
    }));

    const totalPages = Math.ceil(total / Number(limit));

    res.status(200).json({
      success: true,
      page: Number(page),
      limit: Number(limit),
      total,
      totalPages,
      schedule: formatted,
    });
  } catch (err) {
    console.error("getScheduleByTeacher error:", err);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

// GET SCHEDULE BY STUDENT
const getScheduleByStudent = async (req, res) => {
  try {
    const student = req.user;
    const classId = student.classId || (student.classInfo && student.classInfo.id);
    const sectionId = student.sectionId || (student.sectionInfo && student.sectionInfo.id);
    const schoolId = student.school;

    if (!classId || !sectionId) {
      return res.status(400).json({
        success: false,
        message: "Student class or section information not found"
      });
    }

    const {
      type,
      year,
      status,
      startDate,
      endDate,
      page = 1,
      limit = 10
    } = req.query;

    const filter = {
      school: schoolId,
      classId,
      sectionId,
      status: { $ne: 'cancelled' }
    };

    if (type) filter.type = type;
    if (year) filter.year = year;
    if (status) filter.status = status;

    if (startDate) {
      filter.examDate = { $gte: new Date(startDate) };
      if (endDate) {
        filter.examDate.$lte = new Date(endDate);
      }
    }

    const skip = (Number(page) - 1) * Number(limit);

    const [total, schedules] = await Promise.all([
      ExamSchedule.countDocuments(filter),
      ExamSchedule.find(filter)
        .populate("classId", "class sections")
        .populate("subjectId", "name code")
        .populate("teacherId", "name email")
        .sort({ examDate: 1, startTime: 1 })
        .skip(skip)
        .limit(Number(limit))
        .lean()
    ]);

    const formatted = schedules.map(schedule => ({
      _id: schedule._id,
      class: {
        _id: schedule.classId._id,
        name: schedule.classId.class,
      },
      section: extractSection(schedule.classId, schedule.sectionId),
      subject: {
        _id: schedule.subjectId._id,
        name: schedule.subjectId.name,
        code: schedule.subjectId.code,
      },
      teacher: {
        _id: schedule.teacherId._id,
        name: schedule.teacherId.name,
        email: schedule.teacherId.email,
      },
      examDate: schedule.examDate,
      day: schedule.day,
      startTime: schedule.startTime,
      endTime: schedule.endTime,
      type: schedule.type,
      year: schedule.year,
      status: schedule.status
    }));

    const totalPages = Math.ceil(total / Number(limit));

    res.status(200).json({
      success: true,
      page: Number(page),
      limit: Number(limit),
      total,
      totalPages,
      schedule: formatted,
    });
  } catch (err) {
    console.error("getScheduleByStudent error:", err);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

// Helper function to check for conflicts
const checkForConflicts = async (existing, updateData, schoolId) => {

  const examDateTime = updateData.examDate ? new Date(updateData.examDate) : existing.examDate;
  const examStart = updateData.startTime || existing.startTime;
  const examEnd = updateData.endTime || existing.endTime;
  const classId = updateData.classId || existing.classId;
  const sectionId = updateData.sectionId || existing.sectionId;
  const teacherId = updateData.teacherId || existing.teacherId;

  const start1 = toMinutes(examStart);
  const end1 = toMinutes(examEnd);

  console.log(`Checking conflicts for: Date: ${examDateTime.toDateString()}, Time: ${examStart}-${examEnd}, Teacher: ${teacherId}, Class: ${classId}, Section: ${sectionId}`);

  if (teacherId) {
    const teacherConflicts = await ExamSchedule.find({
      _id: { $ne: existing._id },
      school: schoolId,
      teacherId: teacherId,
      examDate: examDateTime,
      status: { $ne: 'cancelled' }
    }).populate("subjectId", "name");

    console.log(`Found ${teacherConflicts.length} teacher schedules on same date`);

    for (const conflict of teacherConflicts) {
      const start2 = toMinutes(conflict.startTime);
      const end2 = toMinutes(conflict.endTime);
      console.log(`Comparing with: ${conflict.startTime}-${conflict.endTime} (Subject: ${conflict.subjectId?.name})`);

      if (start1 < end2 && start2 < end1) {
        console.log(`TIME OVERLAP DETECTED: ${examStart}-${examEnd} overlaps with ${conflict.startTime}-${conflict.endTime}`);
        return {
          success: false,
          message: `Teacher already has "${conflict.subjectId?.name}" exam from ${conflict.startTime} to ${conflict.endTime} on ${examDateTime.toDateString()}`
        };
      }
    }
  }

  if (classId && sectionId) {
    const classConflicts = await ExamSchedule.find({
      _id: { $ne: existing._id },
      school: schoolId,
      classId: classId,
      sectionId: sectionId,
      examDate: examDateTime,
      status: { $ne: 'cancelled' }
    }).populate("subjectId", "name");

    console.log(`Found ${classConflicts.length} class schedules on same date`);

    for (const conflict of classConflicts) {
      const start2 = toMinutes(conflict.startTime);
      const end2 = toMinutes(conflict.endTime);
      console.log(`Comparing with class schedule: ${conflict.startTime}-${conflict.endTime} (Subject: ${conflict.subjectId?.name})`);

      // Check for time overlap
      if (start1 < end2 && start2 < end1) {
        console.log(`CLASS TIME OVERLAP DETECTED: ${examStart}-${examEnd} overlaps with ${conflict.startTime}-${conflict.endTime}`);
        return {
          success: false,
          message: `Class ${conflict.classId} Section ${conflict.sectionId} already has "${conflict.subjectId?.name}" exam from ${conflict.startTime} to ${conflict.endTime} on ${examDateTime.toDateString()}`
        };
      }
    }
  }

  const subjectId = updateData.subjectId || existing.subjectId;
  const type = updateData.type || existing.type;
  const year = updateData.year || existing.year;

  if (subjectId && type && year && classId && sectionId) {
    const duplicate = await ExamSchedule.findOne({
      _id: { $ne: existing._id },
      school: schoolId,
      classId: classId,
      sectionId: sectionId,
      subjectId: subjectId,
      type: type,
      year: year,
      status: { $ne: 'cancelled' }
    }).populate("subjectId", "name");

    if (duplicate) {
      return {
        success: false,
        message: `"${duplicate.subjectId?.name}" already scheduled for ${type} exam in ${year} on ${duplicate.examDate.toDateString()}`
      };
    }
  }

  return null;
};

// UPDATE EXAM SCHEDULE - SINGLE UPDATE ONLY
const updateExamSchedule = async (req, res) => {
  try {
    const { id } = req.params;
    const schoolId = req.user.school;
    const createdBy = req.user._id;
    const updateData = req.body;

    console.log(`Update request for schedule ID: ${id}`);
    console.log('Update data:', updateData);

    const existingSchedule = await ExamSchedule.findById(id)
      .populate("subjectId", "name")
      .populate("teacherId", "name");

    if (!existingSchedule) {
      return res.status(404).json({
        success: false,
        message: "Exam schedule not found"
      });
    }

    if (existingSchedule.school.toString() !== schoolId.toString()) {
      return res.status(403).json({
        success: false,
        message: "You can only update schedules from your school"
      });
    }

    const changes = [];
    const finalUpdateData = {};

    if (updateData.examDate) {
      const newDate = new Date(updateData.examDate);
      const oldDate = new Date(existingSchedule.examDate);
      if (newDate.toDateString() !== oldDate.toDateString()) {
        changes.push(`Date: ${oldDate.toDateString()} → ${newDate.toDateString()}`);
        finalUpdateData.examDate = newDate;
      }
    }

    if (updateData.startTime && updateData.startTime !== existingSchedule.startTime) {
      changes.push(`Start Time: ${existingSchedule.startTime} → ${updateData.startTime}`);
      finalUpdateData.startTime = updateData.startTime;
    }

    if (updateData.endTime && updateData.endTime !== existingSchedule.endTime) {
      changes.push(`End Time: ${existingSchedule.endTime} → ${updateData.endTime}`);
      finalUpdateData.endTime = updateData.endTime;
    }

    if (updateData.day && updateData.day !== existingSchedule.day) {
      changes.push(`Day: ${existingSchedule.day} → ${updateData.day}`);
      finalUpdateData.day = updateData.day;
    }

    if (updateData.type && updateData.type !== existingSchedule.type) {
      changes.push(`Type: ${existingSchedule.type} → ${updateData.type}`);
      finalUpdateData.type = updateData.type;
    }

    if (updateData.year && updateData.year !== existingSchedule.year) {
      changes.push(`Year: ${existingSchedule.year} → ${updateData.year}`);
      finalUpdateData.year = updateData.year;
    }

    if (updateData.status && updateData.status !== existingSchedule.status) {
      changes.push(`Status: ${existingSchedule.status} → ${updateData.status}`);
      finalUpdateData.status = updateData.status;
    }

    if (updateData.teacherId && updateData.teacherId !== existingSchedule.teacherId.toString()) {
      const oldTeacher = await User.findById(existingSchedule.teacherId);
      const newTeacher = await User.findById(updateData.teacherId);

      if (newTeacher) {
        if (newTeacher.school.toString() !== schoolId.toString() || newTeacher.role !== 'teacher') {
          return res.status(400).json({
            success: false,
            message: "Invalid teacher selected"
          });
        }

        if (oldTeacher && newTeacher) {
          changes.push(`Teacher: ${oldTeacher.name} → ${newTeacher.name}`);
        } else if (newTeacher) {
          changes.push(`Teacher: Assigned to ${newTeacher.name}`);
        }
        finalUpdateData.teacherId = updateData.teacherId;
      }
    }

    if (updateData.classId || updateData.sectionId) {
      const classId = updateData.classId || existingSchedule.classId;
      const sectionId = updateData.sectionId || existingSchedule.sectionId;

      const classObj = await ClassSection.findOne({
        _id: classId,
        school: schoolId
      });

      if (!classObj) {
        return res.status(400).json({
          success: false,
          message: "Class not found in your school"
        });
      }

      const sectionExists = classObj.sections.some(
        (sec) => sec._id.toString() === sectionId.toString()
      );

      if (!sectionExists) {
        return res.status(400).json({
          success: false,
          message: "Section not found in this class"
        });
      }

      if (updateData.classId && updateData.classId !== existingSchedule.classId.toString()) {
        const oldClass = await ClassSection.findById(existingSchedule.classId);
        if (oldClass && classObj) {
          changes.push(`Class: ${oldClass.class} → ${classObj.class}`);
        }
        finalUpdateData.classId = updateData.classId;
      }

      if (updateData.sectionId && updateData.sectionId !== existingSchedule.sectionId.toString()) {
        const oldSection = classObj.sections.find(
          (sec) => sec._id.toString() === existingSchedule.sectionId.toString()
        );
        const newSection = classObj.sections.find(
          (sec) => sec._id.toString() === updateData.sectionId.toString()
        );

        if (oldSection && newSection) {
          changes.push(`Section: ${oldSection.name} → ${newSection.name}`);
        }
        finalUpdateData.sectionId = updateData.sectionId;
      }
    }

    if (updateData.subjectId && updateData.subjectId !== existingSchedule.subjectId.toString()) {
      const classId = updateData.classId || existingSchedule.classId;
      const sectionId = updateData.sectionId || existingSchedule.sectionId;

      const subject = await Subject.findOne({
        _id: updateData.subjectId,
        class: classId,
        $or: [
          { sectionId: sectionId },
          { sectionId: null }
        ]
      });

      if (!subject) {
        return res.status(400).json({
          success: false,
          message: "Subject not found for this class/section"
        });
      }

      const oldSubject = await Subject.findById(existingSchedule.subjectId);
      if (oldSubject && subject) {
        changes.push(`Subject: ${oldSubject.name} → ${subject.name}`);
      }
      finalUpdateData.subjectId = updateData.subjectId;
    }

    if (Object.keys(finalUpdateData).length === 0) {
      const updatedSchedule = await ExamSchedule.findById(id)
        .populate("classId", "class sections")
        .populate("subjectId", "name code")
        .populate("teacherId", "name email");

      return res.status(200).json({
        success: true,
        message: "No changes detected",
        data: updatedSchedule
      });
    }

    console.log('Final update data:', finalUpdateData);

    const conflictError = await checkForConflicts(existingSchedule, finalUpdateData, schoolId);
    if (conflictError) {
      return res.status(400).json(conflictError);
    }

    const examDateTime = finalUpdateData.examDate ? new Date(finalUpdateData.examDate) : existingSchedule.examDate;
    const examStart = finalUpdateData.startTime || existingSchedule.startTime;
    const examEnd = finalUpdateData.endTime || existingSchedule.endTime;
    const classId = finalUpdateData.classId || existingSchedule.classId;
    const sectionId = finalUpdateData.sectionId || existingSchedule.sectionId;
    const teacherId = finalUpdateData.teacherId || existingSchedule.teacherId;

    console.log(`Additional safety check for: Date: ${examDateTime.toDateString()}, Time: ${examStart}-${examEnd}`);

    const classOverlap = await ExamSchedule.findOne({
      _id: { $ne: id },
      school: schoolId,
      classId: classId,
      sectionId: sectionId,
      examDate: examDateTime,
      status: { $ne: 'cancelled' },
      $or: [
        {
          $and: [
            { startTime: { $lte: examStart } },
            { endTime: { $gt: examStart } }
          ]
        },
        {
          $and: [
            { startTime: { $lt: examEnd } },
            { endTime: { $gte: examEnd } }
          ]
        },
        {
          $and: [
            { startTime: { $gte: examStart } },
            { endTime: { $lte: examEnd } }
          ]
        }
      ]
    }).populate("subjectId", "name");

    if (classOverlap) {
      console.log(`Class overlap found with schedule: ${classOverlap._id}, Time: ${classOverlap.startTime}-${classOverlap.endTime}`);
      return res.status(400).json({
        success: false,
        message: `Cannot schedule exam. Class already has "${classOverlap.subjectId?.name}" exam from ${classOverlap.startTime} to ${classOverlap.endTime} on ${examDateTime.toDateString()}. Please choose a different time.`
      });
    }

    const teacherOverlap = await ExamSchedule.findOne({
      _id: { $ne: id },
      school: schoolId,
      teacherId: teacherId,
      examDate: examDateTime,
      status: { $ne: 'cancelled' },
      $or: [
        {
          $and: [
            { startTime: { $lte: examStart } },
            { endTime: { $gt: examStart } }
          ]
        },
        {
          $and: [
            { startTime: { $lt: examEnd } },
            { endTime: { $gte: examEnd } }
          ]
        },
        {
          $and: [
            { startTime: { $gte: examStart } },
            { endTime: { $lte: examEnd } }
          ]
        }
      ]
    }).populate("subjectId", "name");

    if (teacherOverlap) {
      console.log(`Teacher overlap found with schedule: ${teacherOverlap._id}, Time: ${teacherOverlap.startTime}-${teacherOverlap.endTime}`);
      return res.status(400).json({
        success: false,
        message: `Cannot schedule exam. Teacher already has "${teacherOverlap.subjectId?.name}" exam from ${teacherOverlap.startTime} to ${teacherOverlap.endTime} on ${examDateTime.toDateString()}. Please choose a different time.`
      });
    }

    const updatedSchedule = await ExamSchedule.findByIdAndUpdate(
      id,
      { $set: finalUpdateData },
      { new: true, runValidators: true }
    )
      .populate("classId", "class sections")
      .populate("subjectId", "name code")
      .populate("teacherId", "name email");

    if (changes.length > 0) {
      await createExamUpdateNotification(
        schoolId,
        updatedSchedule.classId._id,
        updatedSchedule.sectionId,
        {
          subjectName: updatedSchedule.subjectId?.name,
          examDate: updatedSchedule.examDate,
          startTime: updatedSchedule.startTime,
          endTime: updatedSchedule.endTime,
          type: updatedSchedule.type,
          teacherName: updatedSchedule.teacherId?.name
        },
        createdBy,
        updatedSchedule.teacherId?._id,
        changes
      );
    }

    return res.status(200).json({
      success: true,
      message: "Exam schedule updated successfully",
      data: updatedSchedule,
      changes: changes.length > 0 ? changes : undefined
    });

  } catch (error) {
    console.error("updateExamSchedule error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// DELETE EXAM SCHEDULE
const deleteSchedule = async (req, res) => {
  try {
    const { id } = req.params;
    const schoolId = req.user.school;

    const schedule = await ExamSchedule.findById(id)
      .populate("subjectId", "name")
      .populate("teacherId", "name")
      .populate("classId", "class sections");

    if (!schedule) {
      return res.status(404).json({
        success: false,
        message: "Exam schedule not found"
      });
    }

    // Check if schedule belongs to user's school
    if (schedule.school.toString() !== schoolId.toString()) {
      return res.status(403).json({
        success: false,
        message: "You can only delete schedules from your school"
      });
    }

    // Send cancellation notification before deleting
    await createExamCancellationNotification(
      schoolId,
      schedule.classId._id,
      schedule.sectionId,
      {
        subjectName: schedule.subjectId?.name,
        examDate: schedule.examDate,
        startTime: schedule.startTime,
        endTime: schedule.endTime,
        type: schedule.type
      },
      req.user._id,
      schedule.teacherId?._id,
      'Schedule deleted by admin'
    );

    // Delete the schedule
    await ExamSchedule.findByIdAndDelete(id);

    res.status(200).json({
      success: true,
      message: "Exam schedule deleted successfully",
      notification: "Cancellation notification sent to students and teacher"
    });
  } catch (error) {
    console.error("deleteSchedule error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
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