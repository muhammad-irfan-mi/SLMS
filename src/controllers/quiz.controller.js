const ClassSection = require("../models/ClassSection");
const { QuizGroup, QuizSubmission } = require("../models/Quiz");
const User = require("../models/User");
const mongoose = require("mongoose");
const { parseQuizFile } = require("../utils/quizFileParser");

// Helper to detect user role
const detectUserRole = (user) => {
  if (user.role) return user.role;
  
  // Detect school from School model
  if (user.schoolId || (user.verified !== undefined && user.email && !user.role)) {
    return 'school';
  }
  
  return 'unknown';
};

// Validate student class/section
async function validateStudentClassSection(student, classIds = [], sectionIds = []) {
  if (!student) return false;
  if ((!classIds || classIds.length === 0) && (!sectionIds || sectionIds.length === 0)) return true;

  const studentClassId = student.classInfo?.id?.toString() || student.classId?.toString?.();
  const studentSectionId = student.sectionInfo?.id?.toString() || student.sectionId?.toString?.();

  if (classIds.length > 0 && !classIds.map(String).includes(String(studentClassId))) return false;
  if (sectionIds.length > 0 && !sectionIds.map(String).includes(String(studentSectionId))) return false;

  return true;
}

// CREATE quiz group (with optional file upload)
const createQuizGroup = async (req, res) => {
  try {
    const user = req.user;
    const userRole = detectUserRole(user);

    // Only school, admin_office, or teacher can create quizzes
    if (!['school', 'admin_office', 'teacher'].includes(userRole)) {
      return res.status(403).json({ 
        message: "Only school, admin office, or teachers can create quizzes" 
      });
    }

    const { 
      title, 
      description, 
      classIds = [], 
      sectionIds = [], 
      questions = [], 
      startTime, 
      endTime, 
      status = 'draft' 
    } = req.body;

    let quizQuestions = [];

    // Parse questions from file if uploaded
    if (req.file) {
      try {
        quizQuestions = await parseQuizFile(req.file);
        console.log(`Parsed ${quizQuestions.length} questions from file`);
      } catch (parseError) {
        return res.status(400).json({ 
          message: parseError.message 
        });
      }
    } 
    // Use questions from request body if no file
    else if (Array.isArray(questions) && questions.length > 0) {
      quizQuestions = questions.map((q, idx) => ({
        type: q.type,
        title: q.title,
        options: q.options || [],
        correctOptionIndex: q.correctOptionIndex,
        correctAnswer: q.correctAnswer?.toString().trim(),
        marks: Number(q.marks || 1),
        order: q.order || idx
      }));
    } else {
      return res.status(400).json({ 
        message: "Either questions array or question file is required" 
      });
    }

    // Validate at least one question
    if (quizQuestions.length === 0) {
      return res.status(400).json({ 
        message: "At least one valid question is required" 
      });
    }

    // Validate each question
    for (let i = 0; i < quizQuestions.length; i++) {
      const q = quizQuestions[i];
      
      if (!q.type || !['mcq', 'fill'].includes(q.type)) {
        return res.status(400).json({ 
          message: `Invalid question type at position ${i + 1}` 
        });
      }
      
      if (!q.title || q.title.trim().length < 3) {
        return res.status(400).json({ 
          message: `Question title required at position ${i + 1}` 
        });
      }
      
      if (q.type === 'mcq') {
        if (!Array.isArray(q.options) || q.options.length < 2) {
          return res.status(400).json({ 
            message: `MCQ must have at least 2 options at position ${i + 1}` 
          });
        }
        if (typeof q.correctOptionIndex === 'undefined' || q.correctOptionIndex < 0) {
          return res.status(400).json({ 
            message: `Correct option index required for MCQ at position ${i + 1}` 
          });
        }
        if (q.correctOptionIndex >= q.options.length) {
          return res.status(400).json({ 
            message: `Correct option index out of range at position ${i + 1}` 
          });
        }
      } else if (q.type === 'fill') {
        if (!q.correctAnswer || q.correctAnswer.trim().length === 0) {
          return res.status(400).json({ 
            message: `Correct answer required for fill question at position ${i + 1}` 
          });
        }
      }
    }

    // Determine school ID based on role
    let schoolId;
    if (userRole === 'school') {
      schoolId = user._id || user.id;
    } else {
      schoolId = user.school;
    }

    // Validate class and section IDs belong to the school
    if (classIds.length > 0) {
      const validClasses = await ClassSection.find({
        _id: { $in: classIds },
        school: schoolId
      });
      
      if (validClasses.length !== classIds.length) {
        return res.status(400).json({ 
          message: "Some class IDs do not belong to your school" 
        });
      }
    }

    const group = new QuizGroup({
      school: schoolId,
      title,
      description: description || '',
      classIds,
      sectionIds,
      questions: quizQuestions,
      createdBy: user._id,
      startTime: startTime ? new Date(startTime) : undefined,
      endTime: endTime ? new Date(endTime) : undefined,
      status
    });

    await group.save();

    // Get class and section names for response
    let classInfo = [];
    let sectionInfo = [];
    
    if (classIds.length > 0) {
      const classes = await ClassSection.find({ _id: { $in: classIds } })
        .select('class className');
      classInfo = classes.map(cls => ({
        id: cls._id,
        name: cls.className || cls.class
      }));
    }

    return res.status(201).json({ 
      message: "Quiz group created successfully",
      group: {
        _id: group._id,
        title: group.title,
        description: group.description,
        classIds: group.classIds,
        sectionIds: group.sectionIds,
        classInfo,
        sectionInfo,
        totalQuestions: group.questions.length,
        status: group.status,
        startTime: group.startTime,
        endTime: group.endTime,
        createdAt: group.createdAt
      }
    });
  } catch (err) {
    console.error("createQuizGroup error:", err);
    return res.status(500).json({ 
      message: "Server error", 
      error: err.message 
    });
  }
};

// UPDATE quiz group
const updateQuizGroup = async (req, res) => {
  try {
    const user = req.user;
    const userRole = detectUserRole(user);
    const { id } = req.params;

    const group = await QuizGroup.findById(id);
    if (!group) {
      return res.status(404).json({ message: "Group not found" });
    }

    // Authorization check
    let isAuthorized = false;
    
    if (userRole === 'school') {
      const schoolId = user._id || user.id;
      isAuthorized = String(group.school) === String(schoolId) && 
                    String(group.createdBy) === String(user._id);
    } 
    else if (['admin_office', 'teacher'].includes(userRole)) {
      const schoolId = user.school;
      isAuthorized = String(group.school) === String(schoolId);
    }
    else if (userRole === 'superadmin') {
      isAuthorized = true;
    }

    if (!isAuthorized) {
      return res.status(403).json({ 
        message: "Not authorized to update this quiz" 
      });
    }

    const { 
      title, 
      description, 
      classIds, 
      sectionIds, 
      questions, 
      startTime, 
      endTime, 
      status 
    } = req.body;

    // Update fields
    if (title !== undefined) group.title = title;
    if (description !== undefined) group.description = description;
    if (Array.isArray(classIds)) group.classIds = classIds;
    if (Array.isArray(sectionIds)) group.sectionIds = sectionIds;
    if (startTime !== undefined) group.startTime = new Date(startTime);
    if (endTime !== undefined) group.endTime = new Date(endTime);
    if (status && ['draft', 'published', 'archived'].includes(status)) {
      group.status = status;
    }

    // Update questions if provided
    if (Array.isArray(questions) && questions.length > 0) {
      // Validate questions
      questions.forEach((q, i) => {
        if (!q.type || !["mcq", "fill"].includes(q.type)) {
          throw new Error(`Invalid question type at position ${i}`);
        }
        if (!q.title || q.title.trim().length < 3) {
          throw new Error(`Question title required at position ${i}`);
        }
      });

      group.questions = questions.map((q, idx) => ({
        type: q.type,
        title: q.title,
        options: q.options || [],
        correctOptionIndex: q.correctOptionIndex,
        correctAnswer: q.correctAnswer?.toString().trim(),
        marks: Number(q.marks || 1),
        order: q.order || idx
      }));
    }

    await group.save();

    return res.status(200).json({ 
      message: "Quiz updated successfully", 
      group: {
        _id: group._id,
        title: group.title,
        description: group.description,
        status: group.status,
        totalQuestions: group.questions.length,
        updatedAt: group.updatedAt
      }
    });
  } catch (err) {
    console.error("updateQuizGroup error:", err);
    return res.status(500).json({ 
      message: "Server error", 
      error: err.message 
    });
  }
};

// DELETE quiz group
const deleteQuizGroup = async (req, res) => {
  try {
    const user = req.user;
    const userRole = detectUserRole(user);
    const { id } = req.params;

    const group = await QuizGroup.findById(id);
    if (!group) {
      return res.status(404).json({ message: "Group not found" });
    }

    // Authorization check
    let isAuthorized = false;
    
    if (userRole === 'school') {
      const schoolId = user._id || user.id;
      isAuthorized = String(group.school) === String(schoolId) && 
                    String(group.createdBy) === String(user._id);
    } 
    else if (['admin_office', 'teacher'].includes(userRole)) {
      const schoolId = user.school;
      isAuthorized = String(group.school) === String(schoolId);
    }
    else if (userRole === 'superadmin') {
      isAuthorized = true;
    }

    if (!isAuthorized) {
      return res.status(403).json({ 
        message: "Not authorized to delete this quiz" 
      });
    }

    // Delete all submissions first
    await QuizSubmission.deleteMany({ groupId: group._id });
    
    // Delete the quiz group
    await group.deleteOne();

    return res.status(200).json({ 
      message: "Quiz group and all submissions deleted successfully",
      deletedQuiz: {
        _id: group._id,
        title: group.title,
        totalQuestions: group.questions.length
      }
    });
  } catch (err) {
    console.error("deleteQuizGroup error:", err);
    return res.status(500).json({ 
      message: "Server error", 
      error: err.message 
    });
  }
};

// GET quiz groups with filters
const getGroups = async (req, res) => {
  try {
    const user = req.user;
    const userRole = detectUserRole(user);
    
    const { 
      page = 1, 
      limit = 10, 
      status, 
      classId, 
      sectionId, 
      search 
    } = req.query;

    // Determine school ID based on role
    let schoolId;
    if (userRole === 'school') {
      schoolId = user._id || user.id;
    } else if (['admin_office', 'teacher', 'student'].includes(userRole)) {
      schoolId = user.school;
    } else {
      return res.status(403).json({ 
        message: "Not authorized" 
      });
    }

    // Build filter
    const filter = { school: schoolId };

    if (status) filter.status = status;
    if (classId) filter.classIds = classId;
    if (sectionId) filter.sectionIds = sectionId;
    
    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }

    const skip = (page - 1) * limit;

    // Get total count and paginated groups
    const [total, groups] = await Promise.all([
      QuizGroup.countDocuments(filter),
      QuizGroup.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit))
        .lean()
    ]);

    // Get class and section names for each group
    const enrichedGroups = await Promise.all(
      groups.map(async (group) => {
        let classInfo = [];
        let sectionInfo = [];

        if (group.classIds && group.classIds.length > 0) {
          const classes = await ClassSection.find({ 
            _id: { $in: group.classIds },
            school: schoolId 
          }).select('class className sections');
          
          classInfo = classes.map(cls => ({
            id: cls._id,
            name: cls.className || cls.class
          }));

          // Get section info
          if (group.sectionIds && group.sectionIds.length > 0) {
            classes.forEach(cls => {
              cls.sections.forEach(sec => {
                if (group.sectionIds.includes(sec._id.toString())) {
                  sectionInfo.push({
                    id: sec._id,
                    name: sec.name,
                    className: cls.className || cls.class
                  });
                }
              });
            });
          }
        }

        return {
          _id: group._id,
          title: group.title,
          description: group.description,
          status: group.status,
          classIds: group.classIds,
          sectionIds: group.sectionIds,
          classInfo,
          sectionInfo,
          totalQuestions: group.questions.length,
          startTime: group.startTime,
          endTime: group.endTime,
          createdAt: group.createdAt,
          createdBy: group.createdBy
        };
      })
    );

    return res.status(200).json({
      total,
      page: Number(page),
      totalPages: Math.ceil(total / limit),
      limit: Number(limit),
      groups: enrichedGroups
    });
  } catch (err) {
    console.error("getGroups error:", err);
    return res.status(500).json({ 
      message: "Server error", 
      error: err.message 
    });
  }
};

// GET quiz group by ID (student view)
const getGroupById = async (req, res) => {
  try {
    const user = req.user;
    const userRole = detectUserRole(user);
    const { id } = req.params;

    const group = await QuizGroup.findById(id).lean();
    if (!group) {
      return res.status(404).json({ message: "Group not found" });
    }

    // Check if quiz is published
    if (group.status !== 'published') {
      return res.status(403).json({ 
        message: "This quiz is not available" 
      });
    }

    // Time checks
    const now = new Date();
    if (group.startTime && now < new Date(group.startTime)) {
      return res.status(403).json({ 
        message: "Quiz has not started yet" 
      });
    }
    
    if (group.endTime && now > new Date(group.endTime)) {
      return res.status(403).json({ 
        message: "Quiz has ended" 
      });
    }

    // For students, check if they're eligible
    if (userRole === 'student') {
      const student = await User.findById(user._id);
      const isEligible = await validateStudentClassSection(
        student,
        group.classIds,
        group.sectionIds
      );
      
      if (!isEligible) {
        return res.status(403).json({ 
          message: "You are not eligible to attempt this quiz" 
        });
      }

      // Check if already submitted
      const existingSubmission = await QuizSubmission.findOne({
        groupId: id,
        studentId: user._id
      });

      if (existingSubmission) {
        return res.status(400).json({ 
          message: "You have already submitted this quiz",
          submissionId: existingSubmission._id
        });
      }
    }

    // Get class and section names
    let classInfo = [];
    let sectionInfo = [];
    
    if (group.classIds && group.classIds.length > 0) {
      const classes = await ClassSection.find({ 
        _id: { $in: group.classIds },
        school: group.school 
      }).lean();

      classInfo = classes.map(cls => ({
        id: cls._id,
        name: cls.className || cls.class
      }));

      // Get section names
      if (group.sectionIds && group.sectionIds.length > 0) {
        classes.forEach(cls => {
          cls.sections.forEach(sec => {
            if (group.sectionIds.includes(sec._id.toString())) {
              sectionInfo.push({
                id: sec._id,
                name: sec.name,
                className: cls.className || cls.class
              });
            }
          });
        });
      }
    }

    // Remove correct answers for student view
    const safeQuestions = group.questions
      .sort((a, b) => (a.order || 0) - (b.order || 0))
      .map(q => {
        const { correctOptionIndex, correctAnswer, ...safeQuestion } = q;
        return safeQuestion;
      });

    const response = {
      _id: group._id,
      title: group.title,
      description: group.description,
      classInfo,
      sectionInfo,
      questions: safeQuestions,
      totalQuestions: safeQuestions.length,
      totalMarks: group.questions.reduce((sum, q) => sum + (q.marks || 1), 0),
      startTime: group.startTime,
      endTime: group.endTime,
      timeRemaining: group.endTime ? 
        Math.max(0, new Date(group.endTime).getTime() - now.getTime()) : null,
      instructions: "Answer all questions. Each question has specified marks."
    };

    // Add submission status for students
    if (userRole === 'student') {
      response.canSubmit = true;
      response.timeLimit = group.endTime ? 
        Math.floor((new Date(group.endTime).getTime() - now.getTime()) / 60000) + ' minutes' : 
        'No time limit';
    }

    return res.status(200).json({ quiz: response });
  } catch (err) {
    console.error("getGroupById error:", err);
    return res.status(500).json({ 
      message: "Server error", 
      error: err.message 
    });
  }
};

// SUBMIT quiz (student)
const submitQuiz = async (req, res) => {
  try {
    const user = req.user;
    const userRole = detectUserRole(user);
    
    if (userRole !== 'student') {
      return res.status(403).json({ 
        message: "Only students can submit quizzes" 
      });
    }

    const { id } = req.params;
    const { answers = [] } = req.body;

    const group = await QuizGroup.findById(id);
    if (!group) {
      return res.status(404).json({ message: "Quiz not found" });
    }

    if (group.status !== 'published') {
      return res.status(403).json({ 
        message: "This quiz is not available for submission" 
      });
    }

    // Time validation
    const now = new Date();
    if (group.startTime && now < new Date(group.startTime)) {
      return res.status(403).json({ 
        message: "Quiz has not started yet" 
      });
    }
    
    if (group.endTime && now > new Date(group.endTime)) {
      return res.status(403).json({ 
        message: "Quiz submission time has ended" 
      });
    }

    // Student eligibility check
    const student = await User.findById(user._id);
    const isEligible = await validateStudentClassSection(
      student,
      group.classIds,
      group.sectionIds
    );
    
    if (!isEligible) {
      return res.status(403).json({ 
        message: "You are not eligible to submit this quiz" 
      });
    }

    // Prevent duplicate submission
    const existingSubmission = await QuizSubmission.findOne({
      groupId: id,
      studentId: user._id
    });
    
    if (existingSubmission) {
      return res.status(400).json({ 
        message: "You have already submitted this quiz",
        submissionId: existingSubmission._id
      });
    }

    // Validate answers match questions
    const questionMap = new Map();
    group.questions.forEach(q => {
      questionMap.set(q._id.toString(), q);
    });

    // Check for invalid question IDs
    for (const answer of answers) {
      if (!questionMap.has(answer.questionId)) {
        return res.status(400).json({ 
          message: `Invalid question ID: ${answer.questionId}` 
        });
      }
    }

    // Calculate marks
    let totalMarks = 0;
    let obtainedMarks = 0;
    const submissionAnswers = [];

    group.questions.forEach(q => {
      totalMarks += q.marks || 1;
    });

    answers.forEach(answer => {
      const question = questionMap.get(answer.questionId);
      let obtained = 0;

      if (question.type === 'mcq') {
        if (answer.chosenIndex === question.correctOptionIndex) {
          obtained = question.marks || 1;
        }
        
        submissionAnswers.push({
          questionId: question._id,
          type: 'mcq',
          chosenIndex: answer.chosenIndex,
          obtainedMarks: obtained
        });
      } 
      else if (question.type === 'fill') {
        const studentAnswer = (answer.answerText || '').toString().trim();
        const correctAnswer = (question.correctAnswer || '').toString().trim();
        
        // Case-insensitive comparison for text answers
        if (studentAnswer.toLowerCase() === correctAnswer.toLowerCase()) {
          obtained = question.marks || 1;
        }
        
        submissionAnswers.push({
          questionId: question._id,
          type: 'fill',
          answerText: studentAnswer,
          obtainedMarks: obtained
        });
      }

      obtainedMarks += obtained;
    });

    // Create submission
    const submission = await QuizSubmission.create({
      school: group.school,
      groupId: group._id,
      studentId: user._id,
      answers: submissionAnswers,
      totalMarksObtained: obtainedMarks,
      totalMarks: totalMarks,
      submittedAt: now
    });

    // Get detailed feedback
    const feedback = answers.map(answer => {
      const question = questionMap.get(answer.questionId);
      const submissionAnswer = submissionAnswers.find(
        sa => sa.questionId.toString() === answer.questionId
      );

      return {
        questionId: answer.questionId,
        questionTitle: question.title,
        type: question.type,
        studentAnswer: question.type === 'mcq' ? 
          (question.options?.[answer.chosenIndex] || 'Not answered') : 
          (answer.answerText || 'Not answered'),
        correctAnswer: question.type === 'mcq' ? 
          question.options?.[question.correctOptionIndex] : 
          question.correctAnswer,
        obtainedMarks: submissionAnswer?.obtainedMarks || 0,
        totalMarks: question.marks || 1,
        isCorrect: (submissionAnswer?.obtainedMarks || 0) > 0
      };
    });

    return res.status(201).json({
      message: "Quiz submitted successfully",
      submissionId: submission._id,
      score: {
        obtained: obtainedMarks,
        total: totalMarks,
        percentage: totalMarks > 0 ? 
          ((obtainedMarks / totalMarks) * 100).toFixed(2) : 0
      },
      feedback: feedback,
      submittedAt: submission.submittedAt
    });

  } catch (err) {
    console.error("submitQuiz error:", err);
    return res.status(500).json({ 
      message: "Server error", 
      error: err.message 
    });
  }
};

// GET leaderboard
const getLeaderboard = async (req, res) => {
  try {
    const { 
      groupId, 
      page = 1, 
      limit = 20, 
      classId, 
      sectionId 
    } = req.query;

    if (!groupId) {
      return res.status(400).json({ 
        message: "Quiz group ID is required" 
      });
    }

    const group = await QuizGroup.findById(groupId);
    if (!group) {
      return res.status(404).json({ 
        message: "Quiz group not found" 
      });
    }

    const skip = (page - 1) * limit;

    // Build aggregation pipeline
    const pipeline = [
      { 
        $match: { 
          groupId: new mongoose.Types.ObjectId(groupId) 
        } 
      },
      {
        $lookup: {
          from: 'users',
          localField: 'studentId',
          foreignField: '_id',
          as: 'student'
        }
      },
      { $unwind: '$student' }
    ];

    // Add filters
    if (classId) {
      pipeline.push({
        $match: {
          'student.classInfo.id': new mongoose.Types.ObjectId(classId)
        }
      });
    }

    if (sectionId) {
      pipeline.push({
        $match: {
          'student.sectionInfo.id': new mongoose.Types.ObjectId(sectionId)
        }
      });
    }

    // Continue pipeline
    pipeline.push(
      { $sort: { totalMarksObtained: -1, submittedAt: 1 } },
      { $skip: skip },
      { $limit: parseInt(limit, 10) },
      {
        $project: {
          _id: 1,
          studentId: '$student._id',
          studentName: '$student.name',
          studentEmail: '$student.email',
          rollNumber: '$student.rollNumber',
          className: '$student.classInfo.name',
          sectionName: '$student.sectionInfo.name',
          totalMarksObtained: 1,
          totalMarks: 1,
          percentage: {
            $cond: [
              { $eq: ['$totalMarks', 0] },
              0,
              { $multiply: [{ $divide: ['$totalMarksObtained', '$totalMarks'] }, 100] }
            ]
          },
          submittedAt: 1,
          rank: { $add: [1, skip] } // Temporary rank
        }
      }
    );

    // Get total count
    const countPipeline = [
      { $match: { groupId: new mongoose.Types.ObjectId(groupId) } },
      {
        $lookup: {
          from: 'users',
          localField: 'studentId',
          foreignField: '_id',
          as: 'student'
        }
      },
      { $unwind: '$student' }
    ];

    if (classId) {
      countPipeline.push({
        $match: {
          'student.classInfo.id': new mongoose.Types.ObjectId(classId)
        }
      });
    }

    if (sectionId) {
      countPipeline.push({
        $match: {
          'student.sectionInfo.id': new mongoose.Types.ObjectId(sectionId)
        }
      });
    }

    countPipeline.push({ $count: 'total' });

    const [results, countResult] = await Promise.all([
      QuizSubmission.aggregate(pipeline),
      QuizSubmission.aggregate(countPipeline)
    ]);

    const total = countResult[0]?.total || 0;

    // Calculate actual ranks
    const rankedResults = results.map((result, index) => ({
      ...result,
      rank: skip + index + 1,
      percentage: result.percentage.toFixed(2)
    }));

    return res.status(200).json({
      total,
      page: Number(page),
      totalPages: Math.ceil(total / limit),
      limit: Number(limit),
      quizTitle: group.title,
      results: rankedResults
    });

  } catch (err) {
    console.error("getLeaderboard error:", err);
    return res.status(500).json({ 
      message: "Server error", 
      error: err.message 
    });
  }
};

module.exports = {
  createQuizGroup,
  updateQuizGroup,
  deleteQuizGroup,
  getGroups,
  getGroupById,
  submitQuiz,
  getLeaderboard
};