const Project = require("../models/Project");
const mongoose = require("mongoose");
const ClassSection = require("../models/ClassSection");
const User = require("../models/User");
const Schedule = require("../models/Schedule");
const { deleteFileFromS3, uploadFileToS3 } = require("../services/s3.service");
const { validateProject, validateFilter, validateFiles } = require("../validators/project.validation");
const School = require("../models/School");

async function handleProjectUploads(files, existing = {}) {
  let images = existing.images || [];
  let pdf = existing.pdf || null;

  if (files?.images) {
    // delete old images
    for (const img of images)
      await deleteFileFromS3(img);

    images = [];

    for (const file of files.images.slice(0, 2)) {
      const uploaded = await uploadFileToS3({
        fileBuffer: file.buffer,
        fileName: `${Date.now()}-${file.originalname}`,
        mimeType: file.mimetype,
      });
      images.push(uploaded);
    }
  }

  if (files?.pdf?.[0]) {
    if (pdf) await deleteFileFromS3(pdf);

    pdf = await uploadFileToS3({
      fileBuffer: files.pdf[0].buffer,
      fileName: `${Date.now()}-${files.pdf[0].originalname}`,
      mimeType: files.pdf[0].mimetype,
    });
  }

  return { images, pdf };
}

// Handle submission file uploads
async function handleSubmissionUploads(files) {
  let images = [];
  let pdf = null;

  if (files?.images) {
    for (const file of files.images.slice(0, 2)) {
      const uploaded = await uploadFileToS3({
        fileBuffer: file.buffer,
        fileName: `submission-${Date.now()}-${file.originalname}`,
        mimeType: file.mimetype,
      });
      images.push(uploaded);
    }
  }

  if (files?.pdf?.[0]) {
    pdf = await uploadFileToS3({
      fileBuffer: files.pdf[0].buffer,
      fileName: `submission-${Date.now()}-${files.pdf[0].originalname}`,
      mimeType: files.pdf[0].mimetype,
    });
  }

  return { images, pdf };
}

// Check if teacher is authorized to create project for subject
// Updated checkTeacherAuthorization with debugging
const checkTeacherAuthorization = async (school, teacherId, classId, sectionId, subjectId) => {
  if (!teacherId) return true;

  console.log("Checking teacher schedule:", {
    school,
    teacherId,
    classId,
    sectionId,
    subjectId
  });

  // Convert all IDs to ObjectId for consistent comparison
  const schedule = await Schedule.findOne({
    school: new mongoose.Types.ObjectId(school),
    classId: new mongoose.Types.ObjectId(classId),
    sectionId: new mongoose.Types.ObjectId(sectionId),
    subjectId: new mongoose.Types.ObjectId(subjectId),
    teacherId: new mongoose.Types.ObjectId(teacherId)
  });

  return !!schedule;
};
// Validate students belong to class/section
const validateStudentsInClass = async (studentIds, school, classId, sectionId) => {
  if (!studentIds || studentIds.length === 0) return [];

  const students = await User.find({
    _id: { $in: studentIds },
    role: "student",
    school,
    'classInfo.id': classId,
    'sectionInfo.id': sectionId,
    isActive: true
  }).select('_id name email rollNumber').lean();

  const validStudentIds = students.map(s => String(s._id));
  const invalidIds = studentIds.filter(id => !validStudentIds.includes(String(id)));

  return {
    validStudents: students,
    invalidIds
  };
};

// teacher creates project
const createProject = async (req, res) => {
  try {
    console.log("User object:", req.user);

    // IMPORTANT: Handle missing role in user object
    // Try to get role from different possible sources
    let role;

    // Method 1: Check if role exists in user object
    if (req.user.role) {
      role = req.user.role;
    }
    // Method 2: Determine role based on user model fields
    else if (req.user.schoolId && req.user.verified !== undefined) {
      // This looks like a school user (has schoolId field)
      role = 'school';
    }
    // Method 3: Check if it's a User model (teacher/admin/student)
    else if (req.user.email && req.user.classInfo !== undefined) {
      // This is likely a student
      role = 'student';
    } else if (req.user.email && req.user.roleFromDb) {
      // Check for role stored in a different field
      role = req.user.roleFromDb;
    } else {
      // Last resort: default based on JWT token
      // You might need to pass role from middleware
      role = req.userRoleFromToken || 'unknown';
    }

    console.log("Determined role:", role);

    // Handle school users differently
    let school;
    let userId;

    if (role === 'school') {
      // For school users, they ARE the school
      school = req.user._id || req.user.id;
      userId = req.user._id || req.user.id;
    } else if (role === 'admin_office') {
      // For admin office, they should have school reference
      school = req.user.school;
      userId = req.user._id;
    } else if (role === 'teacher') {
      // For teachers, they should have school reference
      school = req.user.school;
      userId = req.user._id;
    } else {
      return res.status(403).json({
        message: "Unauthorized role",
        userInfo: {
          hasRoleField: !!req.user.role,
          userType: req.user.schoolId ? 'school' : 'user',
          availableFields: Object.keys(req.user)
        }
      });
    }

    console.log("Extracted values:", { school, userId, role });

    const {
      title, description, detail,
      classId, sectionId,
      subjectId,
      targetType, studentIds,
      deadline, maxMarks, status = 'assigned'
    } = req.body;

    // Check if user can create project
    const isTeacher = role === 'teacher';
    const isAdminOrSchool = ['admin_office', 'school'].includes(role);

    if (!isTeacher && !isAdminOrSchool) {
      return res.status(403).json({
        message: "Only teachers, admin office, or school can create projects"
      });
    }

    // Validate required fields
    if (!title || !classId || !sectionId || !subjectId) {
      return res.status(400).json({
        message: "title, classId, sectionId and subjectId are required"
      });
    }

    // Validate class and section
    const classDoc = await ClassSection.findOne({
      _id: classId,
      school: school
    }).populate('sections', 'name sectionCode');

    if (!classDoc) {
      return res.status(404).json({
        message: "Class not found or doesn't belong to your school",
        field: "classId"
      });
    }

    // Validate section belongs to class
    const sectionExists = classDoc.sections.some(s => String(s._id) === sectionId);
    if (!sectionExists) {
      return res.status(400).json({
        message: "Section does not belong to selected class",
        field: "sectionId"
      });
    }

    // Validate subject belongs to school
    const Subject = mongoose.model('Subject'); // Make sure to import or get model
    const subject = await Subject.findOne({
      _id: subjectId,
      school: school
    });

    if (!subject) {
      return res.status(404).json({
        message: "Subject not found or doesn't belong to your school",
        field: "subjectId"
      });
    }

    // For teachers, check schedule authorization (skip for school/admin)
    if (isTeacher) {
      const isAuthorized = await checkTeacherAuthorization(
        school, userId, classId, sectionId, subjectId
      );

      if (!isAuthorized) {
        return res.status(403).json({
          message: "Teacher is not assigned this subject in the schedule"
        });
      }
    }

    // If targeting specific students, validate them
    let validatedStudentIds = [];
    if (targetType === "students") {
      if (!studentIds || !Array.isArray(studentIds) || studentIds.length === 0) {
        return res.status(400).json({
          message: "At least one student must be selected",
          field: "studentIds"
        });
      }

      const validationResult = await validateStudentsInClass(
        studentIds, school, classId, sectionId
      );

      if (validationResult.invalidIds.length > 0) {
        return res.status(400).json({
          message: "Some students are not in this class/section",
          invalidStudents: validationResult.invalidIds
        });
      }

      validatedStudentIds = studentIds;
    } else if (targetType === "section") {
      // For section projects, get all students in that section
      const sectionStudents = await User.find({
        school,
        'classInfo.id': classId,
        'sectionInfo.id': sectionId,
        role: 'student',
        isActive: true
      }).select('_id').lean();

      validatedStudentIds = sectionStudents.map(s => s._id);
    }

    // Upload files
    const uploads = await handleProjectUploads(req.files);

    // Create project
    const project = await Project.create({
      school,
      title,
      description: description || "",
      detail: detail || "",
      classId,
      sectionId,
      subjectId,
      assignedBy: userId,
      targetType,
      studentIds: validatedStudentIds,
      deadline: new Date(deadline),
      maxMarks: maxMarks || 100,
      status,
      images: uploads.images,
      pdf: uploads.pdf,
      submissionStats: {
        totalEligible: validatedStudentIds.length,
        submitted: 0,
        graded: 0,
        averageMarks: 0
      }
    });

    // Populate response
    const populatedProject = await Project.findById(project._id)
      .populate('classId', 'class className')
      .populate('subjectId', 'name code')
      .populate('assignedBy', 'name email role')
      .populate({
        path: 'studentIds',
        select: 'name email rollNumber',
        match: { isActive: true }
      });

    return res.status(201).json({
      message: "Project created successfully",
      project: populatedProject
    });

  } catch (err) {
    console.error("createProject error:", err);
    return res.status(500).json({
      message: "Server error",
      error: err.message
    });
  }
};

const getProjects = async (req, res) => {
  try {
    console.log("User object for debugging:", req.user);

    // DETECT ROLE
    let role = req.user.role;

    // If role is missing, detect from fields
    if (!role) {
      if (req.user.schoolId) {
        role = 'school';
      } else if (req.user.classInfo) {
        role = 'student';
      } else if (req.user.school) {
        role = 'teacher'; // default
      }
    }

    const userId = req.user._id;
    let school = req.user.school || req.user._id;

    console.log("User info:", { role, userId, school: String(school) });

    if (!['teacher', 'admin_office', 'school'].includes(role)) {
      return res.status(403).json({
        message: "Unauthorized role",
        detectedRole: role
      });
    }

    const {
      classId, sectionId: querySectionId, subjectId,
      page = 1, limit = 10, status, targetType,
      fromDate, toDate,
      withSubmissions = false,
      createdBy
    } = req.query;

    // Build base filter
    const filter = {
      school: school
    };

    // Role-based filtering
    if (role === 'teacher') {
      filter.assignedBy = userId;
    }
    else if (role === 'admin_office') {
      const adminUsers = await User.find({
        school: school,
        role: 'admin_office'
      }).select('_id').lean();

      const allowedCreators = adminUsers.map(u => u._id);
      allowedCreators.push(school);

      filter.assignedBy = { $in: allowedCreators };

      if (createdBy) {
        const isValidCreator = allowedCreators.some(id =>
          String(id) === String(createdBy)
        );
        if (!isValidCreator) {
          return res.status(403).json({
            message: "Not authorized to view projects by this creator"
          });
        }
        filter.assignedBy = createdBy;
      }
    }
    else if (role === 'school') {
      const schoolUsers = await User.find({
        school: school,
        role: { $in: ['admin_office', 'teacher'] }
      }).select('_id').lean();

      const allowedCreators = schoolUsers.map(u => u._id);
      allowedCreators.push(school);

      filter.assignedBy = { $in: allowedCreators };

      if (createdBy) {
        const isValidCreator = allowedCreators.some(id =>
          String(id) === String(createdBy)
        );
        if (!isValidCreator) {
          return res.status(403).json({
            message: "Invalid creator for this school"
          });
        }
        filter.assignedBy = createdBy;
      }
    }

    // Apply additional filters
    if (classId) filter.classId = classId;
    if (querySectionId) filter.sectionId = querySectionId;
    if (subjectId) filter.subjectId = subjectId;
    if (status) filter.status = status;
    if (targetType) filter.targetType = targetType;

    if (fromDate || toDate) {
      filter.createdAt = {};
      if (fromDate) filter.createdAt.$gte = new Date(fromDate);
      if (toDate) filter.createdAt.$lte = new Date(toDate);
    }

    const skip = (page - 1) * limit;

    // Build query - get basic project data
    let query = Project.find(filter)
      .populate("classId", "class className")
      .populate("subjectId", "name code")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit));

    // Optionally populate submissions
    if (withSubmissions === 'true') {
      query = query.populate({
        path: 'submissions.studentId',
        select: 'name email rollNumber'
      });
    }

    const projects = await query;

    // Get detailed information for each project
    const formattedProjects = await Promise.all(
      projects.map(async (project) => {
        // Get creator info
        let creatorInfo = null;
        const assignedById = project.assignedBy;

        if (String(assignedById) === String(school)) {
          const schoolDoc = await School.findById(school).select('name email');
          creatorInfo = {
            _id: school,
            name: schoolDoc?.name || 'School',
            email: schoolDoc?.email,
            role: 'school'
          };
        } else {
          const user = await User.findById(assignedById).select('name email role');
          creatorInfo = user ? {
            _id: user._id,
            name: user.name,
            email: user.email,
            role: user.role
          } : {
            _id: assignedById,
            name: 'Unknown',
            email: '',
            role: 'unknown'
          };
        }

        // Get SPECIFIC section information from class
        let sectionInfo = null;
        if (project.classId) {
          // Get the class with its sections to find the specific one
          const classWithSections = await ClassSection.findById(project.classId._id)
            .select('sections');

          if (classWithSections && classWithSections.sections) {
            const foundSection = classWithSections.sections.find(
              s => String(s._id) === String(project.sectionId)
            );

            if (foundSection) {
              sectionInfo = {
                _id: foundSection._id,
                name: foundSection.name
                // Add other section fields if needed
              };
            }
          }
        }

        // Build the clean response object
        const formattedProject = {
          _id: project._id,
          school: project.school,
          title: project.title,
          description: project.description,
          detail: project.detail,
          classId: {
            _id: project.classId?._id,
            class: project.classId?.class
            // Don't include className if not needed
          },
          section: sectionInfo || {
            _id: project.sectionId,
            name: 'Unknown Section'
          },
          creator: creatorInfo,
          targetType: project.targetType,
          subjectId: {
            _id: project.subjectId?._id,
            name: project.subjectId?.name,
            code: project.subjectId?.code
          },
          studentIds: project.studentIds,
          deadline: project.deadline,
          maxMarks: project.maxMarks,
          status: project.status,
          images: project.images,
          pdf: project.pdf,
          gradingCompleted: project.gradingCompleted,
          submissionStats: project.submissionStats,
          assignedAt: project.assignedAt,
          submissions: withSubmissions === 'true' ? project.submissions : [],
          submissionCount: project.submissions.length,
          createdAt: project.createdAt,
          updatedAt: project.updatedAt,
          isDeadlinePassed: project.deadline < new Date()
        };

        return formattedProject;
      })
    );

    const total = await Project.countDocuments(filter);

    return res.status(200).json({
      total,
      page: Number(page),
      totalPages: Math.ceil(total / limit),
      limit: Number(limit),
      userRole: role,
      projects: formattedProjects
    });

  } catch (err) {
    console.error("getProjects error:", err);
    return res.status(500).json({
      message: "Server error",
      error: err.message
    });
  }
};


// get projects visible to a student (their section OR assigned specifically to them)
const getProjectsForStudent = async (req, res) => {
  try {
    const school = req.user.school;
    const studentId = req.user._id;
    const classId = req.user.classInfo?.id;
    const sectionId = req.user.sectionInfo?.id;

    console.log("Student info:", {
      studentId: String(studentId),
      classId: classId ? String(classId) : null,
      sectionId: sectionId ? String(sectionId) : null,
      school: String(school)
    });

    if (!classId || !sectionId) {
      return res.status(400).json({
        message: "Student not assigned to class/section"
      });
    }

    const {
      status,
      subjectId,
      deadlineFrom,
      deadlineTo,
      page = 1,
      limit = 10,
      withSubmissions = false
    } = req.query;

    // Build query for student projects
    const filter = {
      school,
      $or: [
        {
          targetType: "section",
          classId,
          sectionId,
          status: { $in: ['assigned', 'completed', 'graded'] }
        },
        {
          targetType: "students",
          studentIds: studentId,
          status: { $in: ['assigned', 'completed', 'graded'] }
        }
      ]
    };

    // Additional filters
    if (status) filter.status = status;
    if (subjectId) filter.subjectId = subjectId;

    if (deadlineFrom || deadlineTo) {
      filter.deadline = {};
      if (deadlineFrom) filter.deadline.$gte = new Date(deadlineFrom);
      if (deadlineTo) filter.deadline.$lte = new Date(deadlineTo);
    }

    const skip = (page - 1) * limit;

    // Build query - similar to teacher endpoint
    let query = Project.find(filter)
      .populate("classId", "class className")
      .populate("subjectId", "name code")
      .populate("assignedBy", "name email role")
      .sort({ deadline: 1, createdAt: -1 })
      .skip(skip)
      .limit(Number(limit));

    // Conditionally populate submissions
    if (withSubmissions === 'true') {
      query = query.populate({
        path: 'submissions.studentId',
        select: 'name email rollNumber'
      });
    }

    const projects = await query;

    // Get detailed information for each project
    const formattedProjects = await Promise.all(
      projects.map(async (project) => {
        // Check student's submission for this project
        const studentSubmission = project.submissions.find(
          sub => String(sub.studentId) === String(studentId)
        );

        // Get creator info
        let creatorInfo = null;
        const assignedById = project.assignedBy;

        if (String(assignedById) === String(school)) {
          const schoolDoc = await School.findById(school).select('name email');
          creatorInfo = {
            _id: school,
            name: schoolDoc?.name || 'School',
            email: schoolDoc?.email,
            role: 'school'
          };
        } else {
          const user = await User.findById(assignedById).select('name email role');
          creatorInfo = user ? {
            _id: user._id,
            name: user.name,
            email: user.email,
            role: user.role
          } : {
            _id: assignedById,
            name: 'Unknown',
            email: '',
            role: 'unknown'
          };
        }

        // Get SPECIFIC section information from class
        let sectionInfo = null;
        if (project.classId) {
          const classWithSections = await ClassSection.findById(project.classId._id)
            .select('sections');

          if (classWithSections && classWithSections.sections) {
            const foundSection = classWithSections.sections.find(
              s => String(s._id) === String(project.sectionId)
            );

            if (foundSection) {
              sectionInfo = {
                _id: foundSection._id,
                name: foundSection.name
              };
            }
          }
        }

        // Build the clean response object
        const formattedProject = {
          _id: project._id,
          school: project.school,
          title: project.title,
          description: project.description,
          detail: project.detail,
          classId: {
            _id: project.classId?._id,
            class: project.classId?.class
          },
          section: sectionInfo || {
            _id: project.sectionId,
            name: 'Unknown Section'
          },
          creator: creatorInfo,
          targetType: project.targetType,
          subjectId: {
            _id: project.subjectId?._id,
            name: project.subjectId?.name,
            code: project.subjectId?.code
          },
          studentIds: project.studentIds,
          deadline: project.deadline,
          maxMarks: project.maxMarks,
          status: project.status,
          images: project.images,
          pdf: project.pdf,
          gradingCompleted: project.gradingCompleted,
          submissionStats: project.submissionStats,
          assignedAt: project.assignedAt,
          submissions: withSubmissions === 'true' ? project.submissions : [],
          submissionCount: project.submissions.length,
          createdAt: project.createdAt,
          updatedAt: project.updatedAt,
          isDeadlinePassed: project.deadline < new Date(),

          // Student-specific fields
          submissionStatus: studentSubmission ? studentSubmission.status : 'pending',
          submittedAt: studentSubmission ? studentSubmission.submittedAt : null,
          hasSubmitted: !!studentSubmission,
          studentMarks: studentSubmission ? studentSubmission.marks : null,
          studentGrade: studentSubmission ? studentSubmission.grade : null,
          studentFeedback: studentSubmission ? studentSubmission.feedback : null,
          canSubmit: project.deadline > new Date() && !studentSubmission,
          isEligible: project.targetType === 'section' ||
            (project.targetType === 'students' &&
              project.studentIds.some(id => String(id) === String(studentId)))
        };

        return formattedProject;
      })
    );

    const total = await Project.countDocuments(filter);

    return res.status(200).json({
      total,
      page: Number(page),
      totalPages: Math.ceil(total / limit),
      limit: Number(limit),
      projects: formattedProjects
    });

  } catch (err) {
    console.error("getProjectsForStudent error:", err);
    return res.status(500).json({
      message: "Server error",
      error: err.message
    });
  }
};

// update project (only assignedBy or admin)
const updateProject = async (req, res) => {
  try {
    const { id } = req.params;
    const { _id: userId, role } = req.user;

    const project = await Project.findById(id)
      .populate('classId', 'class className')
      .populate('subjectId', 'name code');

    if (!project) {
      return res.status(404).json({ message: "Project not found" });
    }

    // Authorization check
    const isCreator = String(project.assignedBy) === String(userId);
    const isAdminOrSchool = ['admin_office', 'school'].includes(role);

    if (!isCreator && !isAdminOrSchool) {
      return res.status(403).json({
        message: "Not authorized to update this project"
      });
    }

    // For teachers updating, verify they still have schedule authorization
    if (role === 'teacher' && isCreator) {
      const isAuthorized = await checkTeacherAuthorization(
        project.school, userId, project.classId, project.sectionId, project.subjectId
      );

      if (!isAuthorized) {
        return res.status(403).json({
          message: "Teacher is no longer assigned this subject in schedule"
        });
      }
    }

    const updates = req.body;

    // If changing target type or student list, validate
    if ((updates.targetType && updates.targetType === 'students') ||
      (updates.studentIds && project.targetType === 'students')) {

      const studentIdsToValidate = updates.studentIds || project.studentIds;

      if (studentIdsToValidate && studentIdsToValidate.length > 0) {
        const validationResult = await validateStudentsInClass(
          studentIdsToValidate,
          project.school,
          project.classId,
          project.sectionId
        );

        if (validationResult.invalidIds.length > 0) {
          return res.status(400).json({
            message: "Some students are not in this class/section",
            invalidStudents: validationResult.invalidIds
          });
        }

        updates.studentIds = studentIdsToValidate;
      }
    }

    const uploads = await handleProjectUploads(req.files, {
      images: project.images,
      pdf: project.pdf
    });

    // Update project
    Object.assign(project, updates);
    project.images = uploads.images.length ? uploads.images : project.images;
    project.pdf = uploads.pdf || project.pdf;

    if (updates.deadline) {
      project.deadline = new Date(updates.deadline);
    }

    await project.save();

    // Get updated project with populated fields
    const updatedProject = await Project.findById(project._id)
      .populate('classId', 'class className')
      .populate('subjectId', 'name code')
      .populate('assignedBy', 'name email role')
      .populate({
        path: 'studentIds',
        select: 'name email rollNumber',
        match: { isActive: true }
      })
      .populate('sectionId', 'name sectionCode');

    return res.status(200).json({
      message: "Project updated successfully",
      project: updatedProject
    });

  } catch (err) {
    console.error("updateProject error:", err);
    return res.status(500).json({
      message: "Server error",
      error: err.message
    });
  }
};

// delete project
const deleteProject = async (req, res) => {
  try {
    const { id } = req.params;
    const { _id: userId, role } = req.user;

    const project = await Project.findById(id);
    if (!project) {
      return res.status(404).json({ message: "Project not found" });
    }

    // Authorization check
    const isCreator = String(project.assignedBy) === String(userId);
    const isAdminOrSchool = ['admin_office', 'school'].includes(role);

    if (!isCreator && !isAdminOrSchool) {
      return res.status(403).json({
        message: "Not authorized to delete this project"
      });
    }

    // Check if there are submissions
    if (project.submissions && project.submissions.length > 0) {
      return res.status(400).json({
        message: "Cannot delete project that has submissions",
        submissionCount: project.submissions.length
      });
    }

    // Delete files from S3
    for (const img of project.images) {
      await deleteFileFromS3(img);
    }

    if (project.pdf) {
      await deleteFileFromS3(project.pdf);
    }

    await project.deleteOne();

    return res.status(200).json({
      message: "Project deleted successfully"
    });

  } catch (err) {
    console.error("deleteProject error:", err);
    return res.status(500).json({
      message: "Server error",
      error: err.message
    });
  }
};

// Submit project (student)
const submitProject = async (req, res) => {
  try {
    const { projectId, submissionText } = req.body;
    const studentId = req.user._id;
    const school = req.user.school;
    const classId = req.user.classInfo?.id;
    const sectionId = req.user.sectionInfo?.id;

    // Validate project exists
    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({ message: "Project not found" });
    }

    // Check if student is eligible to submit
    const isEligible = (
      (project.targetType === 'section' &&
        String(project.classId) === String(classId) &&
        String(project.sectionId) === String(sectionId)) ||
      (project.targetType === 'students' &&
        project.studentIds.some(id => String(id) === String(studentId)))
    );

    if (!isEligible) {
      return res.status(403).json({
        message: "You are not eligible to submit this project"
      });
    }

    // Check if project is still open
    if (project.deadline < new Date()) {
      return res.status(400).json({
        message: "Project submission deadline has passed"
      });
    }

    // Check if already submitted
    const existingSubmission = project.submissions.find(
      sub => String(sub.studentId) === String(studentId)
    );

    if (existingSubmission) {
      return res.status(400).json({
        message: "Project already submitted",
        submissionId: existingSubmission._id,
        submittedAt: existingSubmission.submittedAt
      });
    }

    // Handle submission files
    const uploads = await handleSubmissionUploads(req.files);

    // Create submission object
    const newSubmission = {
      studentId,
      submittedAt: new Date(),
      submissionText: submissionText || "",
      files: {
        images: uploads.images,
        pdf: uploads.pdf
      },
      status: 'submitted'
    };

    // Add submission to project
    project.submissions.push(newSubmission);
    await project.save();

    // Get updated project with populated submission
    const updatedProject = await Project.findById(projectId)
      .populate({
        path: 'submissions.studentId',
        select: 'name email rollNumber'
      });

    const addedSubmission = updatedProject.submissions.find(
      sub => String(sub.studentId) === String(studentId)
    );

    return res.status(201).json({
      message: "Project submitted successfully",
      submission: addedSubmission,
      project: {
        _id: updatedProject._id,
        title: updatedProject.title,
        submissionStats: updatedProject.submissionStats
      }
    });

  } catch (err) {
    console.error("submitProject error:", err);
    return res.status(500).json({
      message: "Server error",
      error: err.message
    });
  }
};

// Grade submission (teacher/admin)
const gradeSubmission = async (req, res) => {
  try {
    const { projectId, submissionId } = req.params;
    const { marks, feedback, grade } = req.body;
    const { _id: userId, role } = req.user;

    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({ message: "Project not found" });
    }

    // Authorization: only creator or admin can grade
    const isCreator = String(project.assignedBy) === String(userId);
    const isAdminOrSchool = ['admin_office', 'school'].includes(role);

    if (!isCreator && !isAdminOrSchool) {
      return res.status(403).json({
        message: "Not authorized to grade submissions"
      });
    }

    // Find the submission
    const submissionIndex = project.submissions.findIndex(
      sub => String(sub._id) === submissionId
    );

    if (submissionIndex === -1) {
      return res.status(404).json({ message: "Submission not found" });
    }

    // Validate marks
    if (marks !== undefined) {
      if (marks < 0 || marks > project.maxMarks) {
        return res.status(400).json({
          message: `Marks must be between 0 and ${project.maxMarks}`
        });
      }
    }

    // Update submission
    project.submissions[submissionIndex].marks = marks;
    project.submissions[submissionIndex].feedback = feedback;
    project.submissions[submissionIndex].grade = grade;
    project.submissions[submissionIndex].status = 'graded';

    await project.save();

    // Get updated project
    const updatedProject = await Project.findById(projectId)
      .populate({
        path: 'submissions.studentId',
        select: 'name email rollNumber'
      });

    return res.status(200).json({
      message: "Submission graded successfully",
      submission: updatedProject.submissions[submissionIndex],
      project: {
        _id: updatedProject._id,
        title: updatedProject.title,
        submissionStats: updatedProject.submissionStats
      }
    });

  } catch (err) {
    console.error("gradeSubmission error:", err);
    return res.status(500).json({
      message: "Server error",
      error: err.message
    });
  }
};

// Get submissions for a project (creator/admin only)
const getProjectSubmissions = async (req, res) => {
  try {
    const { projectId } = req.params;
    const { _id: userId, role } = req.user;
    const { status, graded, studentId } = req.query;

    const project = await Project.findById(projectId)
      .populate('classId', 'className')
      .populate('subjectId', 'name code')
      .populate('assignedBy', 'name email')
      .populate({
        path: 'submissions.studentId',
        select: 'name email rollNumber'
      });

    if (!project) {
      return res.status(404).json({ message: "Project not found" });
    }

    // Authorization: only creator or admin can view submissions
    const isCreator = String(project.assignedBy) === String(userId);
    const isAdminOrSchool = ['admin_office', 'school'].includes(role);

    if (!isCreator && !isAdminOrSchool) {
      return res.status(403).json({
        message: "Not authorized to view submissions"
      });
    }

    // Filter submissions if needed
    let filteredSubmissions = project.submissions;

    if (status) {
      filteredSubmissions = filteredSubmissions.filter(sub => sub.status === status);
    }

    if (graded === 'true') {
      filteredSubmissions = filteredSubmissions.filter(sub => sub.status === 'graded');
    } else if (graded === 'false') {
      filteredSubmissions = filteredSubmissions.filter(sub => sub.status !== 'graded');
    }

    if (studentId) {
      filteredSubmissions = filteredSubmissions.filter(
        sub => String(sub.studentId._id) === studentId
      );
    }

    // Get list of students who haven't submitted
    const submittedStudentIds = project.submissions.map(sub => String(sub.studentId._id));
    const pendingStudents = [];

    if (project.targetType === 'students') {
      const allStudents = await User.find({
        _id: { $in: project.studentIds },
        isActive: true
      }).select('name email rollNumber').lean();

      pendingStudents.push(...allStudents.filter(
        student => !submittedStudentIds.includes(String(student._id))
      ));
    }

    return res.status(200).json({
      project: {
        _id: project._id,
        title: project.title,
        deadline: project.deadline,
        maxMarks: project.maxMarks,
        status: project.status
      },
      totalSubmissions: project.submissions.length,
      filteredSubmissions: filteredSubmissions.length,
      submissions: filteredSubmissions,
      pendingStudents,
      submissionStats: project.submissionStats
    });

  } catch (err) {
    console.error("getProjectSubmissions error:", err);
    return res.status(500).json({
      message: "Server error",
      error: err.message
    });
  }
};

// Get a specific submission
const getSubmission = async (req, res) => {
  try {
    const { projectId, submissionId } = req.params;
    const { _id: userId, role } = req.user;

    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({ message: "Project not found" });
    }

    // Find the submission
    const submission = project.submissions.find(
      sub => String(sub._id) === submissionId
    );

    if (!submission) {
      return res.status(404).json({ message: "Submission not found" });
    }

    // Authorization: student can see their own, creator/admin can see all
    const isStudent = role === 'student';
    const isCreator = String(project.assignedBy) === String(userId);
    const isAdminOrSchool = ['admin_office', 'school'].includes(role);

    if (isStudent && String(submission.studentId) !== String(userId)) {
      return res.status(403).json({
        message: "Not authorized to view this submission"
      });
    }

    if (!isStudent && !isCreator && !isAdminOrSchool) {
      return res.status(403).json({
        message: "Not authorized to view this submission"
      });
    }

    // Populate student info
    const populatedSubmission = { ...submission.toObject() };
    if (submission.studentId) {
      const student = await User.findById(submission.studentId)
        .select('name email rollNumber');
      populatedSubmission.student = student;
    }

    return res.status(200).json({
      submission: populatedSubmission,
      project: {
        _id: project._id,
        title: project.title,
        deadline: project.deadline,
        maxMarks: project.maxMarks
      }
    });

  } catch (err) {
    console.error("getSubmission error:", err);
    return res.status(500).json({
      message: "Server error",
      error: err.message
    });
  }
};

// Update a submission (for resubmission or corrections)
const updateSubmission = async (req, res) => {
  try {
    const { projectId, submissionId } = req.params;
    const { submissionText, status } = req.body;
    const studentId = req.user._id;

    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({ message: "Project not found" });
    }

    // Find the submission
    const submissionIndex = project.submissions.findIndex(
      sub => String(sub._id) === submissionId
    );

    if (submissionIndex === -1) {
      return res.status(404).json({ message: "Submission not found" });
    }

    const submission = project.submissions[submissionIndex];

    // Check authorization - student can update their own, teacher can update if allowed
    const isStudent = req.user.role === 'student';
    const isCreator = String(project.assignedBy) === String(req.user._id);
    const isAdminOrSchool = ['admin_office', 'school'].includes(req.user.role);

    if (isStudent && String(submission.studentId) !== String(studentId)) {
      return res.status(403).json({
        message: "Not authorized to update this submission"
      });
    }

    if (!isStudent && !isCreator && !isAdminOrSchool) {
      return res.status(403).json({
        message: "Not authorized to update this submission"
      });
    }

    // Handle file uploads if any
    const uploads = await handleSubmissionUploads(req.files);

    // Update submission
    if (submissionText !== undefined) {
      project.submissions[submissionIndex].submissionText = submissionText;
    }

    if (status) {
      project.submissions[submissionIndex].status = status;
    }

    // Update files if new ones uploaded
    if (uploads.images.length > 0) {
      // Delete old images from S3
      if (project.submissions[submissionIndex].files.images) {
        for (const img of project.submissions[submissionIndex].files.images) {
          await deleteFileFromS3(img);
        }
      }
      project.submissions[submissionIndex].files.images = uploads.images;
    }

    if (uploads.pdf) {
      // Delete old PDF from S3
      if (project.submissions[submissionIndex].files.pdf) {
        await deleteFileFromS3(project.submissions[submissionIndex].files.pdf);
      }
      project.submissions[submissionIndex].files.pdf = uploads.pdf;
    }

    await project.save();

    // Get updated submission
    const updatedProject = await Project.findById(projectId)
      .populate({
        path: 'submissions.studentId',
        select: 'name email rollNumber'
      });

    return res.status(200).json({
      message: "Submission updated successfully",
      submission: updatedProject.submissions[submissionIndex]
    });

  } catch (err) {
    console.error("updateSubmission error:", err);
    return res.status(500).json({
      message: "Server error",
      error: err.message
    });
  }
};

module.exports = {
  createProject,
  getProjects,
  getProjectsForStudent,
  updateProject,
  deleteProject,
  submitProject,
  gradeSubmission,
  getProjectSubmissions,
  getSubmission,
  updateSubmission
};