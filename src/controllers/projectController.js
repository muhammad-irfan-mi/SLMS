const mongoose = require("mongoose");
const Schedule = require("../models/Schedule");
const User = require("../models/User");
const ClassSection = require("../models/ClassSection");
const School = require("../models/School");
const Project = require("../models/Project");
const Subject = require("../models/Subject");
const { deleteFileFromS3, uploadFileToS3 } = require("../services/s3.service");

// const getClassAndSection = async (classId, sectionId, schoolId) => {
//   if (!classId) return { classInfo: null, sectionInfo: null };

//   const classDoc = await ClassSection.findOne({
//     _id: classId,
//     school: schoolId
//   });

//   if (!classDoc) return { error: "Class not found or does not belong to your school" };

//   const classInfo = {
//     id: classDoc._id,
//     name: classDoc.class
//   };

//   let sectionInfo = null;
//   if (sectionId) {
//     const sectionObj = classDoc.sections.find(
//       (sec) => sec._id.toString() === sectionId
//     );
//     if (!sectionObj) return { error: "Invalid section ID for this class" };

//     sectionInfo = {
//       id: sectionObj._id,
//       name: sectionObj.name
//     };
//   }

//   return { classInfo, sectionInfo };
// };

const getClassAndSection = async (classId, sectionId, schoolId) => {
  if (!classId) return { classInfo: null, sectionInfo: null };

  const classDoc = await ClassSection.findOne({
    _id: classId,
    school: schoolId
  }).lean();

  if (!classDoc) {
    return { classInfo: null, sectionInfo: null };
  }

  const classInfo = {
    _id: classDoc._id,
    name: classDoc.class || classDoc.name
  };

  let sectionInfo = null;
  if (sectionId && classDoc.sections?.length) {
    const sectionObj = classDoc.sections.find(
      sec => sec._id.toString() === sectionId.toString()
    );

    if (sectionObj) {
      sectionInfo = {
        _id: sectionObj._id,
        name: sectionObj.name
      };
    }
  }

  return { classInfo, sectionInfo };
};

const checkTeacherAuthorization = async (school, teacherId, classId, sectionId, subjectId) => {
  if (!teacherId) return true;

  const schedule = await Schedule.findOne({
    school: new mongoose.Types.ObjectId(school),
    classId: new mongoose.Types.ObjectId(classId),
    sectionId: new mongoose.Types.ObjectId(sectionId),
    subjectId: new mongoose.Types.ObjectId(subjectId),
    teacherId: new mongoose.Types.ObjectId(teacherId),
    isActive: true
  });

  return !!schedule;
};

const validateStudentsInClass = async (studentIds, school, classId, sectionId) => {
  if (!studentIds || studentIds.length === 0) return { validStudents: [], invalidIds: [] };

  const students = await User.find({
    _id: { $in: studentIds },
    role: "student",
    school,
    'classInfo.id': classId,
    'sectionInfo.id': sectionId,
  }).select('_id name email rollNo').lean();

  const validStudentIds = students.map(s => String(s._id));
  const invalidIds = studentIds.filter(id => !validStudentIds.includes(String(id)));

  return { validStudents: students, invalidIds };
};

const handleProjectUploads = async (files, existing = {}) => {
  let images = existing.images || [];
  let pdf = existing.pdf || null;

  if (files?.images) {
    for (const img of images) await deleteFileFromS3(img);
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
};

const handleSubmissionUploads = async (files) => {
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
};

const getCreatorInfo = async (assignedBy, schoolId) => {
  const user = await User.findById(assignedBy)
    .select('name email role')
    .lean();

  if (user) {
    return {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role
    };
  }

  const school = await School.findById(schoolId)
    .select('name email')
    .lean();

  if (school) {
    return {
      id: school._id,
      name: school.name,
      email: school.email,
      role: 'school'
    };
  }

  return null;
};



const createProject = async (req, res) => {
  try {

    const { _id: userId, school } = req.user;

    let resolvedRole = req.user.role;
    if (!resolvedRole) {
      if (school && String(school) === String(userId)) {
        resolvedRole = 'school';
      }
    }

    const isTeacher = resolvedRole === 'teacher';
    const isAdminOrSchool = ['admin_office', 'school'].includes(resolvedRole);

    if (!isTeacher && !isAdminOrSchool) {
      return res.status(403).json({
        message: "Only teachers, admin office, or school can create projects"
      });
    }

    const {
      title, description, detail,
      classId, sectionId, subjectId,
      targetType, studentIds,
      deadline, maxMarks, status = 'assigned'
    } = req.body;

    // const isTeacher = role === 'teacher';
    // const isAdminOrSchool = ['admin_office', 'school'].includes(role);
    // console.log(req.user);

    // if (!isTeacher && !isAdminOrSchool) {
    //   return res.status(403).json({ message: "Only teachers, admin office, or school can create projects" });
    // }
    let parsedStudentIds = studentIds;
    if (typeof studentIds === 'string') {
      try {
        parsedStudentIds = JSON.parse(studentIds);
      } catch (error) {
        return res.status(400).json({
          message: 'studentIds must be a valid JSON array string'
        });
      }
    }

    const classDoc = await ClassSection.findOne({ _id: classId, school });
    if (!classDoc) return res.status(404).json({ message: "Class not found or doesn't belong to your school" });

    const sectionExists = classDoc.sections.some(s => String(s._id) === sectionId);
    if (!sectionExists) return res.status(400).json({ message: "Section does not belong to selected class" });

    const subject = await Subject.findOne({ _id: subjectId, school });
    if (!subject) return res.status(404).json({ message: "Subject not found or doesn't belong to your school" });

    if (isTeacher) {
      const isAuthorized = await checkTeacherAuthorization(school, userId, classId, sectionId, subjectId);
      if (!isAuthorized) return res.status(403).json({ message: "Teacher is not assigned this subject in the schedule" });
    }

    let validatedStudentIds = [];
    if (targetType === "students") {
      if (!parsedStudentIds || !Array.isArray(parsedStudentIds) || parsedStudentIds.length === 0) {
        return res.status(400).json({ message: "At least one student must be selected" });
      }

      const validationResult = await validateStudentsInClass(parsedStudentIds, school, classId, sectionId);
      if (validationResult.invalidIds.length > 0) {
        return res.status(400).json({ message: "Some students are not in this class/section" });
      }

      validatedStudentIds = parsedStudentIds;
    } else if (targetType === "section") {
      const sectionStudents = await User.find({
        school,
        'classInfo.id': classId,
        'sectionInfo.id': sectionId,
        role: 'student',
        isActive: true
      }).select('_id').lean();

      validatedStudentIds = sectionStudents.map(s => s._id);
    }

    const uploads = await handleProjectUploads(req.files);
    const projectImages = Array.isArray(uploads.images)
      ? uploads.images
      : uploads.images
        ? [uploads.images]
        : [];

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
      images: projectImages,
      pdf: uploads.pdf,
      submissionStats: {
        totalEligible: validatedStudentIds.length,
        submitted: 0,
        graded: 0,
        averageMarks: 0
      }
    });

    const populatedProject = await Project.findById(project._id)
      .populate('classId', 'class')
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
    return res.status(500).json({ message: "Server error" });
  }
};

const getProjects = async (req, res) => {
  try {
    const { school, _id: userId, role } = req.user;
    const {
      classId, sectionId: querySectionId, subjectId,
      page = 1, limit = 10, status, targetType,
      fromDate, toDate,
      withSubmissions = false,
      createdBy
    } = req.query;

    const filter = { school };

    if (role === 'teacher') {
      filter.assignedBy = userId;
    } else if (role === 'admin_office' || role === 'school') {
      const allowedUsers = await User.find({
        school,
        role: role === 'admin_office' ? 'admin_office' : { $in: ['admin_office', 'teacher'] }
      }).select('_id').lean();

      const allowedCreators = allowedUsers.map(u => u._id);
      allowedCreators.push(school);

      filter.assignedBy = { $in: allowedCreators };

      if (createdBy) {
        const isValidCreator = allowedCreators.some(id => String(id) === String(createdBy));
        if (!isValidCreator) return res.status(403).json({ message: "Not authorized to view projects by this creator" });
        filter.assignedBy = createdBy;
      }
    }

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
    let query = Project.find(filter)
      .populate("classId", "class")
      .populate("subjectId", "name code")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit));

    const includeSubmissions = withSubmissions === true || withSubmissions === 'true';
    if (includeSubmissions) {
      query = query.populate({
        path: 'submissions.studentId',
        select: 'name email rollNumber'
      });
    }

    const projects = await query;

    const formattedProjects = await Promise.all(
      projects.map(async (project) => {
        const creator = await getCreatorInfo(project.assignedBy, school);
        const { classInfo, sectionInfo } = await getClassAndSection(
          project.classId,
          project.sectionId,
          school
        );

        return {
          _id: project._id,
          school: project.school,
          title: project.title,
          description: project.description,
          detail: project.detail,
          classInfo,
          sectionInfo,
          creator,
          targetType: project.targetType,
          subjectInfo: project.subjectId,
          studentIds: project.studentIds,
          deadline: project.deadline,
          maxMarks: project.maxMarks,
          status: project.status,
          images: project.images,
          pdf: project.pdf,
          gradingCompleted: project.gradingCompleted,
          submissionStats: project.submissionStats,
          submissions: includeSubmissions ? project.submissions : [],
          submissionCount: project.submissions.length,
          createdAt: project.createdAt,
          isDeadlinePassed: project.deadline < new Date()
        };
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
    console.error("getProjects error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

const updateProject = async (req, res) => {
  try {
    const { id } = req.params;
    const { school, _id: userId, role } = req.user;

    const project = await Project.findById(id);
    if (!project) return res.status(404).json({ message: "Project not found" });

    const isCreator = String(project.assignedBy) === String(userId);
    const isAdminOrSchool = ['admin_office', 'school'].includes(role);
    if (!isCreator && !isAdminOrSchool) return res.status(403).json({ message: "Not authorized to update this project" });

    if (role === 'teacher' && isCreator) {
      const isAuthorized = await checkTeacherAuthorization(project.school, userId, project.classId, project.sectionId, project.subjectId);
      if (!isAuthorized) return res.status(403).json({ message: "Teacher is no longer assigned this subject in schedule" });
    }

    const updates = req.body;
    if ((updates.targetType && updates.targetType === 'students') || (updates.studentIds && project.targetType === 'students')) {
      const studentIdsToValidate = updates.studentIds || project.studentIds;
      if (studentIdsToValidate && studentIdsToValidate.length > 0) {
        const validationResult = await validateStudentsInClass(studentIdsToValidate, project.school, project.classId, project.sectionId);
        if (validationResult.invalidIds.length > 0) {
          return res.status(400).json({ message: "Some students are not in this class/section" });
        }
        updates.studentIds = studentIdsToValidate;
      }
    }

    const uploads = await handleProjectUploads(req.files, {
      images: project.images,
      pdf: project.pdf
    });

    Object.assign(project, updates);
    project.images = uploads.images.length ? uploads.images : project.images;
    project.pdf = uploads.pdf || project.pdf;
    if (updates.deadline) project.deadline = new Date(updates.deadline);

    await project.save();

    const updatedProject = await Project.findById(project._id)
      .populate('classId', 'class')
      .populate('subjectId', 'name code')
      .populate('assignedBy', 'name email role')
      .populate({
        path: 'studentIds',
        select: 'name email rollNumber',
        match: { isActive: true }
      });

    return res.status(200).json({
      message: "Project updated successfully",
      project: updatedProject
    });

  } catch (err) {
    return res.status(500).json({ message: "Server error" });
  }
};

const deleteProject = async (req, res) => {
  try {
    const { id } = req.params;
    const { _id: userId, role } = req.user;

    const project = await Project.findById(id);
    if (!project) return res.status(404).json({ message: "Project not found" });

    const isCreator = String(project.assignedBy) === String(userId);
    const isAdminOrSchool = ['admin_office', 'school'].includes(role);
    if (!isCreator && !isAdminOrSchool) return res.status(403).json({ message: "Not authorized to delete this project" });

    await project.deleteOne();
    return res.status(200).json({ message: "Project deleted successfully" });

  } catch (err) {
    console.error("deleteProject error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

const getProjectsForStudent = async (req, res) => {
  try {
    const { school, _id: studentId, classInfo, sectionInfo } = req.user;
    const classId = classInfo?.id;
    const sectionId = sectionInfo?.id;

    if (!classId || !sectionId) return res.status(400).json({ message: "Student not assigned to class/section" });

    const { status, subjectId, deadlineFrom, deadlineTo, page = 1, limit = 10, withSubmissions = false } = req.query;

    const filter = {
      school,
      $or: [
        { targetType: "section", classId, sectionId, status: { $in: ['assigned', 'completed', 'graded'] } },
        { targetType: "students", studentIds: studentId, status: { $in: ['assigned', 'completed', 'graded'] } }
      ]
    };

    if (status) filter.status = status;
    if (subjectId) filter.subjectId = subjectId;

    if (deadlineFrom || deadlineTo) {
      filter.deadline = {};
      if (deadlineFrom) filter.deadline.$gte = new Date(deadlineFrom);
      if (deadlineTo) filter.deadline.$lte = new Date(deadlineTo);
    }

    const skip = (page - 1) * limit;
    let query = Project.find(filter)
      .populate("classId", "class")
      .populate("subjectId", "name code")
      .populate("assignedBy", "name email role")
      .sort({ deadline: 1, createdAt: -1 })
      .skip(skip)
      .limit(Number(limit));

    if (withSubmissions === 'true') {
      query = query.populate({
        path: 'submissions.studentId',
        select: 'name email rollNumber'
      });
    }

    const projects = await query;

    const formattedProjects = await Promise.all(
      projects.map(async (project) => {
        const studentSubmission = project.submissions.find(sub => String(sub.studentId) === String(studentId));
        const creator = await getCreatorInfo(project.assignedBy, school);
        const classSection = await getClassAndSection(project.classId, project.sectionId, school);

        return {
          _id: project._id,
          title: project.title,
          description: project.description,
          detail: project.detail,
          classInfo: classSection.classInfo,
          sectionInfo: classSection.sectionInfo,
          creator,
          targetType: project.targetType,
          subjectInfo: project.subjectId,
          deadline: project.deadline,
          maxMarks: project.maxMarks,
          status: project.status,
          images: project.images,
          pdf: project.pdf,
          submissionStatus: studentSubmission ? studentSubmission.status : 'pending',
          submittedAt: studentSubmission ? studentSubmission.submittedAt : null,
          hasSubmitted: !!studentSubmission,
          studentMarks: studentSubmission ? studentSubmission.marks : null,
          studentGrade: studentSubmission ? studentSubmission.grade : null,
          studentFeedback: studentSubmission ? studentSubmission.feedback : null,
          canSubmit: project.deadline > new Date() && !studentSubmission,
          isEligible: project.targetType === 'section' ||
            (project.targetType === 'students' && project.studentIds.some(id => String(id) === String(studentId)))
        };
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
    return res.status(500).json({ message: "Server error" });
  }
};

const submitProject = async (req, res) => {
  try {
    const { projectId } = req.params;
    const { submissionText } = req.body;
    const { school, _id: studentId, classInfo, sectionInfo } = req.user;
    const classId = classInfo?.id;
    const sectionId = sectionInfo?.id;

    const project = await Project.findById(projectId);
    if (!project) return res.status(404).json({ message: "Project not found" });

    const isEligible = (
      (project.targetType === 'section' &&
        String(project.classId) === String(classId) &&
        String(project.sectionId) === String(sectionId)) ||
      (project.targetType === 'students' &&
        project.studentIds.some(id => String(id) === String(studentId)))
    );

    if (!isEligible) return res.status(403).json({ message: "You are not eligible to submit this project" });
    if (project.deadline < new Date()) return res.status(400).json({ message: "Project submission deadline has passed" });

    const existingSubmission = project.submissions.find(sub => String(sub.studentId) === String(studentId));
    if (existingSubmission) return res.status(400).json({ message: "Project already submitted" });

    const uploads = await handleSubmissionUploads(req.files);
    const newSubmission = {
      studentId,
      submittedAt: new Date(),
      submissionText: submissionText || "",
      files: { images: uploads.images, pdf: uploads.pdf },
      status: 'submitted'
    };

    project.submissions.push(newSubmission);
    await project.save();

    const updatedProject = await Project.findById(projectId).populate({
      path: 'submissions.studentId',
      select: 'name email rollNumber'
    });

    const addedSubmission = updatedProject.submissions.find(sub => String(sub.studentId) === String(studentId));

    return res.status(201).json({
      message: "Project submitted successfully",
      submission: addedSubmission
    });

  } catch (err) {
    console.error("submitProject error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

const gradeSubmission = async (req, res) => {
  try {
    const { projectId, submissionId } = req.params;
    const { marks, feedback, grade } = req.body;
    const { _id: userId, role } = req.user;

    const project = await Project.findById(projectId);
    if (!project) return res.status(404).json({ message: "Project not found" });

    const isCreator = String(project.assignedBy) === String(userId);
    const isAdminOrSchool = ['admin_office', 'school'].includes(role);
    if (!isCreator && !isAdminOrSchool) return res.status(403).json({ message: "Not authorized to grade submissions" });

    const submissionIndex = project.submissions.findIndex(sub => String(sub._id) === submissionId);
    if (submissionIndex === -1) return res.status(404).json({ message: "Submission not found" });

    if (marks !== undefined && (marks < 0 || marks > project.maxMarks)) {
      return res.status(400).json({ message: `Marks must be between 0 and ${project.maxMarks}` });
    }

    project.submissions[submissionIndex].marks = marks;
    project.submissions[submissionIndex].feedback = feedback;
    project.submissions[submissionIndex].grade = grade;
    project.submissions[submissionIndex].status = 'graded';

    await project.save();

    const updatedProject = await Project.findById(projectId).populate({
      path: 'submissions.studentId',
      select: 'name email rollNumber'
    });

    return res.status(200).json({
      message: "Submission graded successfully",
      submission: updatedProject.submissions[submissionIndex]
    });

  } catch (err) {
    console.error("gradeSubmission error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

const getProjectSubmissions = async (req, res) => {
  try {
    console.log(req.user)
    const { projectId } = req.params;
    const { _id: userId, role } = req.user;
    const { status, graded, studentId } = req.query;

    const project = await Project.findById(projectId)
      .populate('classId', 'class')
      .populate('subjectId', 'name code')
      .populate('assignedBy', 'name email')
      .populate({
        path: 'submissions.studentId',
        select: 'name email rollNumber'
      });

    if (!project) return res.status(404).json({ message: "Project not found" });

    const isCreator = String(project.assignedBy._id) === String(userId);
    const isAdminOrSchool = ['admin_office', 'school'].includes(role);
    if (!isCreator && !isAdminOrSchool) return res.status(403).json({ message: "Not authorized to view submissions" });

    let filteredSubmissions = project.submissions;
    if (status) filteredSubmissions = filteredSubmissions.filter(sub => sub.status === status);
    if (graded === 'true') filteredSubmissions = filteredSubmissions.filter(sub => sub.status === 'graded');
    else if (graded === 'false') filteredSubmissions = filteredSubmissions.filter(sub => sub.status !== 'graded');
    if (studentId) filteredSubmissions = filteredSubmissions.filter(sub => String(sub.studentId._id) === studentId);

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

    const formattedSubmissions = filteredSubmissions.map(sub => ({
      _id: sub._id,
      files: sub.files,
      submittedAt: sub.submittedAt,
      submissionText: sub.submissionText,
      status: sub.status,
      grade: sub.grade,
      studentInfo: sub.studentId ? {
        _id: sub.studentId._id,
        name: sub.studentId.name,
        email: sub.studentId.email,
        rollNumber: sub.studentId.rollNumber
      } : null
    }));

    return res.status(200).json({
      totalSubmissions: project.submissions.length,
      filteredSubmissions: filteredSubmissions.length,
      submissions: formattedSubmissions,
      // pendingStudents,
      // submissionStats: project.submissionStats
    });

  } catch (err) {
    console.error("getProjectSubmissions error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

const getSubmission = async (req, res) => {
  try {
    const { projectId, submissionId } = req.params;
    const { _id: userId, role } = req.user;

    const project = await Project.findById(projectId);
    if (!project) return res.status(404).json({ message: "Project not found" });

    const submission = project.submissions.find(sub => String(sub._id) === submissionId);
    if (!submission) return res.status(404).json({ message: "Submission not found" });

    const isStudent = role === 'student';
    const isCreator = String(project.assignedBy) === String(userId);
    const isAdminOrSchool = ['admin_office', 'school'].includes(role);

    if (isStudent && String(submission.studentId) !== String(userId)) {
      return res.status(403).json({ message: "Not authorized to view this submission" });
    }

    if (!isStudent && !isCreator && !isAdminOrSchool) {
      return res.status(403).json({ message: "Not authorized to view this submission" });
    }

    const populatedSubmission = { ...submission.toObject() };
    if (submission.studentId) {
      const student = await User.findById(submission.studentId).select('name email rollNumber');
      populatedSubmission.student = student;
    }

    return res.status(200).json({ submission: populatedSubmission });

  } catch (err) {
    console.error("getSubmission error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

module.exports = {
  createProject,
  getProjects,
  updateProject,
  getProjectsForStudent,
  submitProject,
  gradeSubmission,
  getProjectSubmissions,
  getSubmission,
  deleteProject,
};
