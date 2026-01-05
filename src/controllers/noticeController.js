const mongoose = require("mongoose");
const ClassSection = require("../models/ClassSection");
const Notice = require("../models/Notice");
const User = require("../models/User");

const formatDate = (d) => {
  if (!d) return undefined;
  const D = new Date(d);
  return `${D.getFullYear()}-${String(D.getMonth() + 1).padStart(2, "0")}-${String(D.getDate()).padStart(2, "0")}`;
};

// Create notice
const createNotice = async (req, res) => {
  try {
    const school = req.user.school;
    const createdBy = req.user._id;
    const {
      title, message, target, targetTeacherIds, targetStudentIds,
      classId, sectionId, category, startDate, endDate, attachments, pinned
    } = req.body;

    // Validate class and section if provided
    if (classId) {
      const classExists = await ClassSection.findOne({
        _id: classId,
        school: school
      });

      if (!classExists) {
        return res.status(400).json({
          success: false,
          message: "Class not found in your school"
        });
      }

      if (sectionId) {
        const sectionExists = classExists.sections.some(
          (sec) => String(sec._id) === String(sectionId)
        );

        if (!sectionExists) {
          return res.status(400).json({
            success: false,
            message: "Section not found in this class"
          });
        }
      }
    }

    // Validate teacher IDs belong to the same school
    if (targetTeacherIds && targetTeacherIds.length > 0) {
      const teachers = await User.find({
        _id: { $in: targetTeacherIds },
        school: school,
        role: 'teacher'
      });

      if (teachers.length !== targetTeacherIds.length) {
        return res.status(400).json({
          success: false,
          message: "One or more teachers not found in your school"
        });
      }
    }

    // Validate student IDs belong to the same school
    if (targetStudentIds && targetStudentIds.length > 0) {
      const students = await User.find({
        _id: { $in: targetStudentIds },
        school: school,
        role: 'student'
      });

      if (students.length !== targetStudentIds.length) {
        return res.status(400).json({
          success: false,
          message: "One or more students not found in your school"
        });
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

    return res.status(201).json({
      success: true,
      message: "Notice created successfully",
      data: notice
    });

  } catch (err) {
    console.error("createNotice error:", err);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

// Get notices for teachers/admins
const getNotices = async (req, res) => {
  try {
    console.log("req.user:", req.user);
    const user = req.user;

    // Get school ID - school document has _id directly
    const schoolId = user._id || user.id;

    console.log("School ID:", schoolId);

    const {
      classId,
      sectionId,
      category,
      activeOnly,
      target,
      startDate,
      endDate,
      search,
      page = 1,
      limit = 10,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    const now = new Date();
    const filter = { school: schoolId };

    // Apply basic filters
    if (classId) filter.classId = classId;
    if (sectionId) filter.sectionId = sectionId;
    if (category) filter.category = category;
    if (target) filter.target = target;

    // Date range filter
    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) {
        filter.createdAt.$gte = new Date(startDate);
      }
      if (endDate) {
        const endDateObj = new Date(endDate);
        endDateObj.setHours(23, 59, 59, 999);
        filter.createdAt.$lte = endDateObj;
      }
    }

    // Text search
    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: "i" } },
        { message: { $regex: search, $options: "i" } }
      ];
    }

    // Active only filter
    if (activeOnly === "true") {
      filter.$and = (filter.$and || []).concat([
        {
          $or: [
            { startDate: { $exists: false } },
            { startDate: { $lte: now } }
          ]
        },
        {
          $or: [
            { endDate: { $exists: false } },
            { endDate: { $gte: now } }
          ]
        }
      ]);
    }

    // Check user type
    if (!user.role) {
      console.log("School login - showing all notices for school");
    }
    else if (user.role === "teacher") {
      console.log("Teacher login");
      const teacherFilters = [
        { target: "all" },
        { target: "all_teachers" },
        { target: "class", classId: user.classId || null },
        {
          target: "section",
          classId: user.classId || null,
          sectionId: user.sectionId || null
        },
        { target: "selected_teachers", targetTeacherIds: user._id || user.id },
        { target: "custom", targetTeacherIds: user._id || user.id }
      ];

      filter.$and = [
        { school: schoolId },
        { $or: teacherFilters }
      ];
      delete filter.school;
    }
    else if (["admin_office", "school"].includes(user.role)) {
      console.log("Admin login with role:", user.role);
    }
    else {
      console.log("Access denied for user:", user);
      return res.status(403).json({
        success: false,
        message: "Access denied. Teacher, Admin, or School role required."
      });
    }

    const skip = (Number(page) - 1) * Number(limit);
    const sortDirection = sortOrder === "asc" ? 1 : -1;

    console.log("Final filter:", JSON.stringify(filter, null, 2));

    // Import models
    const User = require('../models/User'); // Adjust path as needed
    const School = require('../models/School'); // Adjust path as needed

    // Build query
    const query = Notice.find(filter)
      .populate("classId", "class")
      .populate("targetTeacherIds", "name email role")
      .populate("targetStudentIds", "name email rollNo")
      .sort({ pinned: -1, [sortBy]: sortDirection })
      .skip(skip)
      .limit(Number(limit));

    // Execute queries
    const [total, notices] = await Promise.all([
      Notice.countDocuments(filter),
      query.lean()
    ]);

    // Process notices to populate createdBy (can be User or School)
    const processedNotices = await Promise.all(
      notices.map(async (notice) => {
        const noticeObj = { ...notice };

        if (notice.createdBy) {
          try {
            // Try to find as User first
            const userDoc = await User.findById(notice.createdBy)
              .select('name email role schoolId username');

            if (userDoc) {
              noticeObj.createdBy = {
                _id: userDoc._id,
                name: userDoc.name,
                email: userDoc.email,
                role: userDoc.role,
                username: userDoc.username
              };
            } else {
              // If not found as User, try as School
              const schoolDoc = await School.findById(notice.createdBy)
                .select('name email schoolId');

              if (schoolDoc) {
                noticeObj.createdBy = {
                  _id: schoolDoc._id,
                  name: schoolDoc.name,
                  email: schoolDoc.email,
                  role: 'school',
                  schoolId: schoolDoc.schoolId
                };
              } else {
                // If still not found, keep as is
                noticeObj.createdBy = notice.createdBy;
              }
            }
          } catch (err) {
            console.error("Error populating createdBy:", err);
            noticeObj.createdBy = notice.createdBy;
          }
        }

        return noticeObj;
      })
    );

    // Calculate pagination info
    const totalPages = Math.ceil(total / Number(limit));
    const hasNextPage = page < totalPages;
    const hasPrevPage = page > 1;

    return res.status(200).json({
      total,
      page: Number(page),
      limit: Number(limit),
      totalPages,
      data: processedNotices,
    });

  } catch (err) {
    console.error("getNotices error:", err);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

// Get notices for student
const getNoticesForStudent = async (req, res) => {
  try {
    console.log("Student req.user:", req.user);

    // For students, req.user should be a user document with role "student"
    const user = req.user;
    const studentId = user._id || user.id;

    // Get school ID - check different possible locations
    const schoolId = user.school || user.schoolId || (user.schoolInfo && user.schoolInfo.id);

    if (!schoolId) {
      return res.status(400).json({
        success: false,
        message: "School information not found for student"
      });
    }

    const classId = user.classId || (user.classInfo && user.classInfo.id);
    const sectionId = user.sectionId || (user.sectionInfo && user.sectionInfo.id);

    console.log("Student info:", { studentId, schoolId, classId, sectionId });

    const {
      category,
      activeOnly,
      startDate,
      endDate,
      search,
      page = 1,
      limit = 10
    } = req.query;

    const now = new Date();
    const filter = { school: schoolId }; // Filter by school ID

    // Apply basic filters
    if (category) filter.category = category;

    // Date range filter
    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) {
        filter.createdAt.$gte = new Date(startDate);
      }
      if (endDate) {
        const endDateObj = new Date(endDate);
        endDateObj.setHours(23, 59, 59, 999);
        filter.createdAt.$lte = endDateObj;
      }
    }

    // Text search
    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: "i" } },
        { message: { $regex: search, $options: "i" } }
      ];
    }

    // Student-specific filters
    // Students see notices targeted to all students, their class, their section, or specifically to them
    const studentFilters = [
      { target: "all" },
      { target: "all_students" },
      { target: "class", classId: classId },
      {
        target: "section",
        classId: classId,
        sectionId: sectionId
      },
      { target: "selected_students", targetStudentIds: studentId },
      { target: "custom", targetStudentIds: studentId }
    ];

    // Remove null filters (if student doesn't have class/section info)
    const validFilters = studentFilters.filter(filterItem => {
      if (filterItem.target === "class" && !classId) return false;
      if (filterItem.target === "section" && (!classId || !sectionId)) return false;
      return true;
    });

    // Add school filter and student filters
    filter.$and = [
      { school: schoolId },
      { $or: validFilters }
    ];

    // Remove individual school filter since it's in $and now
    delete filter.school;

    // Active only filter
    if (activeOnly === "true") {
      filter.$and = filter.$and.concat([
        {
          $or: [
            { startDate: { $exists: false } },
            { startDate: { $lte: now } }
          ]
        },
        {
          $or: [
            { endDate: { $exists: false } },
            { endDate: { $gte: now } }
          ]
        }
      ]);
    }

    console.log("Student filter:", JSON.stringify(filter, null, 2));

    const skip = (Number(page) - 1) * Number(limit);

    // Build query
    const query = Notice.find(filter)
      .populate("createdBy", "name email role")
      .populate("classId", "class")
      .sort({ pinned: -1, createdAt: -1 })
      .skip(skip)
      .limit(Number(limit));

    // Execute queries in parallel
    const [total, notices] = await Promise.all([
      Notice.countDocuments(filter),
      query.lean()
    ]);

    // Calculate pagination info
    const totalPages = Math.ceil(total / Number(limit));
    const hasNextPage = page < totalPages;
    const hasPrevPage = page > 1;

    return res.status(200).json({
      total,
      page: Number(page),
      limit: Number(limit),
      totalPages,
      data: notices,
    });

  } catch (err) {
    console.error("getNoticesForStudent error:", err);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

// Update notice
const updateNotice = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;
    const userRole = req.user.role;
    const schoolId = req.user.school;

    const notice = await Notice.findById(id);
    if (!notice) {
      return res.status(404).json({
        success: false,
        message: "Notice not found"
      });
    }

    // Check if notice belongs to user's school
    if (notice.school.toString() !== schoolId.toString()) {
      return res.status(403).json({
        success: false,
        message: "You can only update notices from your school"
      });
    }

    // Check authorization: only creator or admin can edit
    const isCreator = notice.createdBy.toString() === userId.toString();
    const isAdmin = ["admin_office", "superadmin", "school"].includes(userRole);

    if (!isCreator && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to edit this notice"
      });
    }

    // Validate teacher/student IDs if provided in update
    if (req.body.targetTeacherIds && req.body.targetTeacherIds.length > 0) {
      const teachers = await User.find({
        _id: { $in: req.body.targetTeacherIds },
        school: schoolId,
        role: 'teacher'
      });

      if (teachers.length !== req.body.targetTeacherIds.length) {
        return res.status(400).json({
          success: false,
          message: "One or more teachers not found in your school"
        });
      }
    }

    if (req.body.targetStudentIds && req.body.targetStudentIds.length > 0) {
      const students = await User.find({
        _id: { $in: req.body.targetStudentIds },
        school: schoolId,
        role: 'student'
      });

      if (students.length !== req.body.targetStudentIds.length) {
        return res.status(400).json({
          success: false,
          message: "One or more students not found in your school"
        });
      }
    }

    // Format dates if provided
    if (req.body.startDate) {
      req.body.startDate = formatDate(req.body.startDate);
    }
    if (req.body.endDate) {
      req.body.endDate = formatDate(req.body.endDate);
    }

    const updated = await Notice.findByIdAndUpdate(
      id,
      { $set: req.body },
      { new: true, runValidators: true }
    ).populate("createdBy", "name email");

    return res.status(200).json({
      success: true,
      message: "Notice updated successfully",
      data: updated
    });
  } catch (err) {
    console.error("updateNotice error:", err);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

// Delete notice
const deleteNotice = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;
    const userRole = req.user.role;
    const schoolId = req.user.school;

    const notice = await Notice.findById(id);
    if (!notice) {
      return res.status(404).json({
        success: false,
        message: "Notice not found"
      });
    }

    // Check if notice belongs to user's school
    if (notice.school.toString() !== schoolId.toString()) {
      return res.status(403).json({
        success: false,
        message: "You can only delete notices from your school"
      });
    }

    // Check authorization: only creator or admin can delete
    const isCreator = notice.createdBy.toString() === userId.toString();
    const isAdmin = ["admin_office", "superadmin", "school"].includes(userRole);

    if (!isCreator && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to delete this notice"
      });
    }

    await notice.deleteOne();

    return res.status(200).json({
      success: true,
      message: "Notice deleted successfully"
    });
  } catch (err) {
    console.error("deleteNotice error:", err);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

module.exports = {
  createNotice,
  getNotices,
  getNoticesForStudent,
  updateNotice,
  deleteNotice
};