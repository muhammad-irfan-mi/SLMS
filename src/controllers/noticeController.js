const mongoose = require("mongoose");
const ClassSection = require("../models/ClassSection");
const Notice = require("../models/Notice");
const User = require("../models/User");
const School = require('../models/School');

const formatDate = (d) => {
  if (!d) return undefined;
  const D = new Date(d);
  return `${D.getFullYear()}-${String(D.getMonth() + 1).padStart(2, "0")}-${String(D.getDate()).padStart(2, "0")}`;
};

// Create notice
const createNotice = async (req, res) => {
  try {
    const school = req.user.school;
    const userRole = req.user.role || 'school';
    const createdBy = req.user._id;
    const {
      title, message, target, targetTeacherIds, targetStudentIds,
      classId, sectionId, category, startDate, endDate, attachments, pinned
    } = req.body;

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

    let requestedByModel = "User";

    if (userRole === "school") {
      requestedByModel = "School";
    }

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
      requestedByModel,
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

// Get notices for teachers
const getNotices = async (req, res) => {
  try {
    const user = req.user;

    const schoolId = user.school || user.schoolId || (user.schoolInfo && user.schoolInfo.id);

    if (!schoolId) {
      return res.status(400).json({
        success: false,
        message: "School information not found"
      });
    }

    const userId = user._id || user.id;
    const userRole = user.role || 'school';
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

    const teacherClassId = user.classId || (user.classInfo && user.classInfo.id);
    const teacherSectionId = user.sectionId || (user.sectionInfo && user.sectionInfo.id);
    const teacherId = user._id || user.id;

    const now = new Date();
    const filter = { school: schoolId };

    if (classId) filter.classId = classId;
    if (sectionId) filter.sectionId = sectionId;
    if (category) filter.category = category;
    if (target) filter.target = target;

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

    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: "i" } },
        { message: { $regex: search, $options: "i" } }
      ];
    }

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

    if (!user.role) {
      console.log("School login - showing all notices for school");
    }
    else if (userRole === "teacher") {

      const teacherFilters = [
        { target: "all" },
        { target: "all_teachers" },
        // { target: "custom" },
        { target: "selected_teachers", targetTeacherIds: teacherId }
      ];

      if (teacherClassId) {
        teacherFilters.push({ target: "class", classId: teacherClassId });
      }

      if (teacherClassId && teacherSectionId) {
        teacherFilters.push({
          target: "section",
          classId: teacherClassId,
          sectionId: teacherSectionId
        });
      }

      const validFilters = teacherFilters.filter(filterItem => {
        if (filterItem.target === "class" && !filterItem.classId) return false;
        if (filterItem.target === "section" && (!filterItem.classId || !filterItem.sectionId)) return false;
        return true;
      });


      filter.$and = [
        { school: schoolId },
        { $or: validFilters }
      ];

    }
    else if (["admin_office", "school", "superadmin"].includes(user.role)) {
      console.log("Admin login with role:", user.role);
    }
    else {
      return res.status(403).json({
        success: false,
        message: "Access denied. Teacher, Admin, or School role required."
      });
    }

    const skip = (Number(page) - 1) * Number(limit);
    const sortDirection = sortOrder === "asc" ? 1 : -1;

    const query = Notice.find(filter)
      .populate("classId", "class")
      .populate("targetTeacherIds", "name email role")
      .populate("targetStudentIds", "name email rollNo")
      .populate("readBy.user", "name email role")
      .sort({ pinned: -1, [sortBy]: sortDirection })
      .skip(skip)
      .limit(Number(limit));

    const [total, notices] = await Promise.all([
      Notice.countDocuments(filter),
      query.lean()
    ]);

    const processedNotices = await Promise.all(
      notices.map(async (notice) => {
        const noticeObj = { ...notice };

        if (userRole === "teacher" || userRole === "student") {
          const hasRead = notice.readBy && notice.readBy.some(read =>
            read.user && read.user._id && read.user._id.toString() === userId.toString()
          );

          noticeObj.isRead = hasRead;

          if (hasRead) {
            const readRecord = notice.readBy && notice.readBy.find(read =>
              read.user && read.user._id && read.user._id.toString() === userId.toString()
            );
            noticeObj.readAt = readRecord ? readRecord.readAt : null;
          }

          noticeObj.readCount = notice.readBy ? notice.readBy.length : 0;
        }

        if (userRole === "teacher") {
          delete noticeObj.targetTeacherIds;
          delete noticeObj.targetStudentIds;

          delete noticeObj.readBy;

          if (notice.target === "selected_teachers" || notice.target === "selected_students") {
            if (notice.target === "selected_teachers" && Array.isArray(notice.targetTeacherIds)) {
              noticeObj.isTargetedToMe = notice.targetTeacherIds.some(id =>
                id.toString() === userId.toString()
              );
            } else if (notice.target === "selected_students") {
              noticeObj.isTargetedToMe = false;
            }
          } else {
            noticeObj.isTargetedToMe = true;
          }
        }

        if (["admin_office", "school", "superadmin"].includes(userRole)) {
          delete noticeObj.readBy;
          delete noticeObj.isRead;
          delete noticeObj.readAt;
          delete noticeObj.readCount;
        }

        if (notice.createdBy) {
          try {
            const userDoc = await User.findById(notice.createdBy)
              .select('name email role schoolId username images.recentPic');

            if (userDoc) {
              noticeObj.createdBy = {
                _id: userDoc._id,
                name: userDoc.name,
                email: userDoc.email,
                role: userDoc.role,
                username: userDoc.username,
                image: userDoc.images && userDoc.images.recentPic ? userDoc.images.recentPic : null,
              };
            } else {
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

    const totalPages = Math.ceil(total / Number(limit));

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

// Get notices for admins
const getAdminNotices = async (req, res) => {
  try {
    const user = req.user;
    const schoolId = user.school || user.schoolId || (user.schoolInfo && user.schoolInfo.id);

    if (!schoolId) {
      return res.status(400).json({
        success: false,
        message: "School ID not found"
      });
    }


    const {
      category,
      activeOnly,
      startDate,
      endDate,
      search,
      page = 1,
      limit = 10,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    const now = new Date();
    const filter = {
      school: new mongoose.Types.ObjectId(schoolId),
      target: "admin"
    };


    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: 'i' } },
        { message: { $regex: search, $options: 'i' } }
      ];
    }

    if (category) {
      filter.category = category;
    }

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

    if (user.role === 'admin_office' || user.role === 'superadmin' || user.role === 'school') {
      filter.$or = [
        { target: "admin" },
      ];
    }

    const skip = (Number(page) - 1) * Number(limit);
    const sortDirection = sortOrder === "asc" ? 1 : -1;


    const [total, notices] = await Promise.all([
      Notice.countDocuments(filter),
      Notice.find(filter)
        .populate("createdBy", "name email role images.recentPic")
        .populate("classId", "class")
        .populate("targetTeacherIds", "name email role")
        .populate("targetStudentIds", "name email rollNo")
        .populate("targetAdminIds", "name email role")
        .populate({
          path: 'readBy.user',
          select: 'name email role',
        })
        .sort({
          pinned: -1,
          createdAt: sortDirection
        })
        .skip(skip)
        .limit(Number(limit))
        .lean()
    ]);

    const formattedNotices = notices.map(notice => {
      const hasRead = notice.readBy?.some(read =>
        String(read.user?._id) === String(user._id)
      );

      return {
        _id: notice._id,
        school: notice.school,
        title: notice.title,
        message: notice.message,
        createdBy: notice.createdBy,
        target: notice.target,
        attachments: notice.attachments || [],
        hasRead: hasRead || false,
        readCount: notice.readBy?.length || 0,
        createdAt: notice.createdAt,
        updatedAt: notice.updatedAt
      };
    });

    const totalPages = Math.ceil(total / Number(limit));

    return res.status(200).json({
      success: true,
      total,
      page: Number(page),
      limit: Number(limit),
      totalPages,
      notices: formattedNotices
    });

  } catch (err) {
    console.error("Error in getAdminNotices:", err);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

const getNoticesForStudent = async (req, res) => {
  try {
    const user = req.user;
    const studentId = user._id || user.id;
    const userId = studentId;

    const schoolId = user.school || user.schoolId || (user.schoolInfo && user.schoolInfo.id);

    if (!schoolId) {
      return res.status(400).json({
        success: false,
        message: "School information not found for student"
      });
    }

    const classId = user.classId || (user.classInfo && user.classInfo.id);
    const sectionId = user.sectionId || (user.sectionInfo && user.sectionInfo.id);

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
    const filter = { school: schoolId };

    if (category) filter.category = category;

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

    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: "i" } },
        { message: { $regex: search, $options: "i" } }
      ];
    }

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

    const validFilters = studentFilters.filter(filterItem => {
      if (filterItem.target === "class" && !classId) return false;
      if (filterItem.target === "section" && (!classId || !sectionId)) return false;
      return true;
    });

    filter.$and = [
      { school: schoolId },
      { $or: validFilters }
    ];

    delete filter.school;

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

    const skip = (Number(page) - 1) * Number(limit);

    const query = Notice.find(filter)
      .select('-targetTeacherIds -targetStudentIds') 
      .sort({ pinned: -1, createdAt: -1 })
      .skip(skip)
      .limit(Number(limit));

    const [total, notices] = await Promise.all([
      Notice.countDocuments(filter),
      query.lean()
    ]);

    const noticeIds = notices.map(notice => notice._id);

    const readNotices = await Notice.find({
      _id: { $in: noticeIds },
      'readBy.user': studentId
    }).select('_id readBy.$');

    const readMap = new Map();
    readNotices.forEach(notice => {
      const readEntry = notice.readBy.find(read =>
        read.user.toString() === studentId.toString()
      );
      if (readEntry) {
        readMap.set(notice._id.toString(), readEntry.readAt);
      }
    });

    const processedNotices = await Promise.all(
      notices.map(async (notice) => {
        const noticeObj = { ...notice };

        const readAt = readMap.get(notice._id.toString());
        noticeObj.isRead = !!readAt;

        if (readAt) {
          noticeObj.readAt = readAt;
        }

        noticeObj.readCount = notice.readBy ? notice.readBy.length : 0;
        delete noticeObj.readBy;

        if (notice.createdBy) {
          try {
            let creatorDoc = await User.findById(notice.createdBy)
              .select('name email role schoolId username images.recentPic')
              .lean();

            if (creatorDoc) {
              noticeObj.createdBy = {
                _id: creatorDoc._id,
                name: creatorDoc.name,
                email: creatorDoc.email,
                role: creatorDoc.role,
                username: creatorDoc.username,
                image: creatorDoc.images?.recentPic || null,
              };
            } else {
              const schoolDoc = await School.findById(notice.createdBy)
                .select('name email schoolId')
                .lean();

              if (schoolDoc) {
                noticeObj.createdBy = {
                  _id: schoolDoc._id,
                  name: schoolDoc.name,
                  email: schoolDoc.email,
                  role: "school",
                  schoolId: schoolDoc.schoolId,
                  image: null
                };
              } else {
                noticeObj.createdBy = {
                  _id: notice.createdBy,
                  name: "Unknown",
                  email: null,
                  role: "unknown",
                  image: null
                };
              }
            }
          } catch (err) {
            noticeObj.createdBy = {
              _id: notice.createdBy,
              name: "Unknown",
              email: null,
              role: "unknown",
              image: null
            };
          }
        } else {
          noticeObj.createdBy = {
            _id: null,
            name: "System",
            email: null,
            role: "system",
            image: null
          };
        }
        
        if (notice.target === "selected_students" || notice.target === "custom") {
          noticeObj.isTargetedToMe = true;
        } else {
          noticeObj.isTargetedToMe = true;
        }

        return noticeObj;
      })
    );

    const totalPages = Math.ceil(total / Number(limit));
    const hasNextPage = page < totalPages;
    const hasPrevPage = page > 1;

    return res.status(200).json({
      success: true,
      total,
      page: Number(page),
      limit: Number(limit),
      totalPages,
      hasNextPage,
      hasPrevPage,
      data: processedNotices,
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

// Mark notice as read
const markAsRead = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id || req.user.id;

    const notice = await Notice.findById(id);
    if (!notice) {
      return res.status(404).json({
        success: false,
        message: "Notice not found"
      });
    }

    const alreadyRead = notice.readBy.some(read =>
      read.user.toString() === userId.toString()
    );

    if (!alreadyRead) {
      notice.readBy.push({
        user: userId,
        readAt: new Date()
      });

      await notice.save();
    }

    return res.status(200).json({
      success: true,
      message: alreadyRead ? "Notice already marked as read" : "Notice marked as read",
      data: {
        noticeId: notice._id,
        read: true,
        readAt: alreadyRead
          ? notice.readBy.find(r => r.user.toString() === userId.toString()).readAt
          : notice.readBy[notice.readBy.length - 1].readAt
      }
    });

  } catch (err) {
    console.error("markAsRead error:", err);
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
  getAdminNotices,
  getNoticesForStudent,
  updateNotice,
  deleteNotice,
  markAsRead
};