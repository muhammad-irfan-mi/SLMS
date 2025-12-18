const ClassSection = require("../models/ClassSection");
const { QuizGroup, QuizSubmission } = require("../models/Quiz");
const User = require("../models/User");
const mongoose = require("mongoose");

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

// CREATE quiz group
const createQuizGroup = async (req, res) => {
    try {
        const user = req.user;

        const { title, description, classIds = [], sectionIds = [], questions = [] } = req.body;
        if (!title || !Array.isArray(questions) || questions.length === 0)
            return res.status(400).json({ message: "Title and questions required" });

        // validate questions
        questions.forEach((q, i) => {
            if (!q.type || !["mcq", "fill"].includes(q.type)) throw new Error(`Invalid type at ${i}`);
            if (!q.title) throw new Error(`Title required at ${i}`);
            if (q.type === "mcq") {
                if (!Array.isArray(q.options) || q.options.length < 2) throw new Error(`MCQ options required at ${i}`);
                if (typeof q.correctOptionIndex !== "number") throw new Error(`correctOptionIndex required at ${i}`);
            } else {
                if (typeof q.correctAnswer === "undefined") throw new Error(`correctAnswer required at ${i}`);
            }
        });

        const group = new QuizGroup({
            school: user.school,
            title,
            description,
            classIds,
            sectionIds,
            questions: questions.map((q, idx) => ({
                type: q.type,
                title: q.title,
                options: q.options || [],
                correctOptionIndex: q.correctOptionIndex,
                correctAnswer: q.correctAnswer?.toString().trim(),
                marks: Number(q.marks || 1),
                order: q.order || idx
            })),
            createdBy: user._id,
            //   startTime: startTime ? new Date(startTime) : undefined,
            //   endTime: endTime ? new Date(endTime) : undefined,
            status: "published"
        });

        await group.save();
        return res.status(201).json({ message: "Quiz group created", group });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ message: err.message });
    }
};

// UPDATE quiz group
const updateQuizGroup = async (req, res) => {
    try {
        const user = req.user;
        const { id } = req.params;
        const group = await QuizGroup.findById(id);
        if (!group) return res.status(404).json({ message: "Group not found" });

        if (String(group.createdBy) !== String(user._id) && user.role !== "superadmin")
            return res.status(403).json({ message: "Not authorized" });

        const { title, description, classIds, sectionIds, questions, startTime, endTime, status } = req.body;
        if (title) group.title = title;
        if (description) group.description = description;
        if (Array.isArray(classIds)) group.classIds = classIds;
        if (Array.isArray(sectionIds)) group.sectionIds = sectionIds;
        if (startTime) group.startTime = new Date(startTime);
        if (endTime) group.endTime = new Date(endTime);
        if (status && ["draft", "published", "archived"].includes(status)) group.status = status;

        if (Array.isArray(questions)) {
            questions.forEach((q, i) => {
                if (!q.type || !["mcq", "fill"].includes(q.type)) throw new Error(`Invalid type at ${i}`);
                if (!q.title) throw new Error(`Title required at ${i}`);
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
        return res.status(200).json({ message: "Quiz updated", group });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ message: err.message });
    }
};

//  DELETE quiz group
const deleteQuizGroup = async (req, res) => {
    try {
        const user = req.user;
        const { id } = req.params;
        const group = await QuizGroup.findById(id);
        if (!group) return res.status(404).json({ message: "Group not found" });

        if (String(group.createdBy) !== String(user._id) && user.role !== "superadmin")
            return res.status(403).json({ message: "Not authorized" });

        await QuizSubmission.deleteMany({ groupId: group._id });
        await group.deleteOne();
        return res.status(200).json({ message: "Group and submissions deleted" });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ message: err.message });
    }
};

//  GET groups for admin (filters & pagination)
const getGroups = async (req, res) => {
    try {
        const user = req.user;
        const { page = 1, limit = 1, status, classId, sectionId } = req.query;

        const filter = { school: user.school };
        if (status) filter.status = status;

        // Convert to objectId for filter
        if (classId) filter.classIds = new mongoose.Types.ObjectId(classId);
        if (sectionId) filter.sectionIds = new mongoose.Types.ObjectId(sectionId);

        const skip = (page - 1) * limit;

        // Load all class + section mapping for this school
        const classSectionDocs = await ClassSection.find({ school: user.school }).lean();

        // Create lookup maps
        const classMap = new Map(); // classId → className
        const sectionMap = new Map(); // sectionId → {name, classId}

        classSectionDocs.forEach(cls => {
            classMap.set(String(cls._id), cls.class);

            cls.sections.forEach(sec => {
                sectionMap.set(String(sec._id), {
                    name: sec.name,
                    classId: cls._id
                });
            });
        });

        const [total, groups] = await Promise.all([
            QuizGroup.countDocuments(filter),
            QuizGroup.find(filter)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(Number(limit))
                .lean()
        ]);

        // Attach class & section names
        const enrichedGroups = groups.map(group => {
            const classInfo = (group.classIds || []).map(cid => ({
                id: cid,
                name: classMap.get(String(cid)) || "Unknown Class"
            }));

            const sectionInfo = (group.sectionIds || []).map(secId => {
                const data = sectionMap.get(String(secId));
                return {
                    id: secId,
                    name: data ? data.name : "Unknown Section",
                    classId: data ? data.classId : null
                };
            });

            return {
                ...group,
                classInfo,
                sectionInfo
            };
        });

        return res.status(200).json({
            total,
            page: Number(page),
            totalPages: Math.ceil(total / limit),
            groups: enrichedGroups
        });
    } catch (err) {
        console.error("getGroups error:", err);
        return res.status(500).json({ message: err.message });
    }
};


// GET group by ID (student view)
const getGroupById = async (req, res) => {
    try {
        const user = req.user;
        const { id } = req.params;

        const group = await QuizGroup.findById(id).lean();
        if (!group) return res.status(404).json({ message: "Group not found" });

        if (group.status !== "published")
            return res.status(403).json({ message: "Quiz not available" });

        const now = new Date();
        if (group.startTime && now < new Date(group.startTime))
            return res.status(403).json({ message: "Quiz not started" });

        if (group.endTime && now > new Date(group.endTime))
            return res.status(403).json({ message: "Quiz ended" });

        // If student => validate class/section
        if (user.role === "student") {
            const student = await User.findById(user._id);
            const ok = await validateStudentClassSection(
                student,
                group.classIds,
                group.sectionIds
            );
            if (!ok) return res.status(403).json({ message: "Not allowed to attempt" });
        }

        // -------------------------------
        // 🔍 Fetch class-section names
        // -------------------------------
        const classSectionDocs = await ClassSection.find({
            school: group.school
        }).lean();

        const classNames = [];
        const sectionNames = [];

        // Class names
        group.classIds?.forEach(cid => {
            const cs = classSectionDocs.find(c => c._id.toString() === cid.toString());
            if (cs) classNames.push(cs.class);
        });

        // Section names + belonging class
        group.sectionIds?.forEach(sid => {
            classSectionDocs.forEach(cs => {
                const sec = cs.sections.find(s => s._id.toString() === sid.toString());
                if (sec) {
                    sectionNames.push({
                        section: sec.name,
                        class: cs.class
                    });
                }
            });
        });

        // -------------------------------
        // 🛡 Remove answers before sending
        // -------------------------------
        const safeQuestions = group.questions
            .sort((a, b) => a.order - b.order)
            .map(q => {
                const { correctOptionIndex, correctAnswer, ...rest } = q;
                return rest;
            });

        group.questions = safeQuestions;

        // Attach readable names
        group.classNames = classNames;
        group.sectionNames = sectionNames;

        return res.status(200).json({ group });

    } catch (err) {
        console.error("getGroupById error:", err);
        return res.status(500).json({ message: err.message });
    }
};


// SUBMIT quiz (student)
const submitQuiz = async (req, res) => {
    try {
        const user = req.user;
        if (!user || user.role !== "student")
            return res.status(403).json({ message: "Only students can submit quiz" });

        const { id } = req.params;
        const { answers = [] } = req.body;

        const group = await QuizGroup.findById(id);
        if (!group) return res.status(404).json({ message: "Quiz group not found" });
        if (group.status !== "published") return res.status(403).json({ message: "Quiz unavailable" });

        // Time check
        const now = new Date();
        if (group.startTime && now < group.startTime)
            return res.status(403).json({ message: "Quiz not started" });
        if (group.endTime && now > group.endTime)
            return res.status(403).json({ message: "Quiz ended" });

        // Student class/section check
        const student = await User.findById(user._id);
        const ok = await validateStudentClassSection(student, group.classIds, group.sectionIds);
        if (!ok) return res.status(403).json({ message: "Not allowed for this quiz" });

        // Prevent duplicate submission
        const existing = await QuizSubmission.findOne({ groupId: id, studentId: user._id });
        if (existing) return res.status(400).json({ message: "Quiz already submitted" });

        // Build question map with pure string IDs
        const qMap = new Map();
        group.questions.forEach(q => {
            qMap.set(q._id.toString(), q);
        });

        // STRICT VALIDATION: Reject ANY invalid questionId
        // STRICT VALIDATION
        for (const ans of answers) {
            if (!ans.questionId) {
                return res.status(400).json({ message: "Missing questionId in answer" });
            }

            const qid = ans.questionId.toString().trim();

            // Check valid ObjectId format
            if (!/^[0-9a-fA-F]{24}$/.test(qid)) {
                return res.status(400).json({
                    message: `Invalid questionId format: ${qid}`
                });
            }

            // Check if question belongs to this quiz
            if (!qMap.has(qid)) {
                return res.status(400).json({
                    message: `Invalid question submitted: ${qid}`
                });
            }
        }

        let totalMarks = 0;
        let obtained = 0;
        const submissionAnswers = [];
        const feedback = [];

        // Calculate total marks of quiz
        for (const q of group.questions) {
            totalMarks += Number(q.marks || 1);
        }

        // Evaluate answers
        for (const ans of answers) {
            const qid = ans.questionId.toString();
            const q = qMap.get(qid);

            let obtainedMarks = 0;
            let isCorrect = false;

            if (q.type === "mcq") {
                const chosen = Number(ans.chosenIndex);
                const correctIndex = Number(q.correctOptionIndex); // Force number
                if (!isNaN(chosen) && !isNaN(correctIndex) && chosen === correctIndex) {
                    obtainedMarks = Number(q.marks);
                    isCorrect = true;
                }

                submissionAnswers.push({
                    questionId: q._id,
                    type: "mcq",
                    chosenIndex: chosen,
                    obtainedMarks
                });

                feedback.push({
                    questionId: q._id,
                    type: "mcq",
                    chosenIndex: chosen,
                    correctOptionIndex: q.correctOptionIndex,
                    correct: isCorrect
                });

            } else if (q.type === "fill") {
                const answerText = (ans.answerText || "").toString().trim();
                const correct = (q.correctAnswer || "").toString().trim();

                const aNum = parseFloat(answerText);
                const cNum = parseFloat(correct);

                if (!isNaN(aNum) && !isNaN(cNum)) {
                    if (Math.abs(aNum - cNum) < 1e-9) {
                        obtainedMarks = Number(q.marks);
                        isCorrect = true;
                    }
                } else if (answerText.toLowerCase() === correct.toLowerCase()) {
                    obtainedMarks = Number(q.marks);
                    isCorrect = true;
                }

                submissionAnswers.push({
                    questionId: q._id,
                    type: "fill",
                    answerText,
                    obtainedMarks
                });

                feedback.push({
                    questionId: q._id,
                    type: "fill",
                    answerText,
                    correctAnswer: correct,
                    correct: isCorrect
                });
            }

            obtained += obtainedMarks;
        }

        // Save submission
        const submission = await QuizSubmission.create({
            school: group.school,
            groupId: group._id,
            studentId: user._id,
            answers: submissionAnswers,
            totalMarksObtained: obtained,
            totalMarks
        });

        return res.status(201).json({
            message: "Quiz submitted successfully",
            totalMarks,
            obtainedMarks: obtained,
            percentage: ((obtained / totalMarks) * 100).toFixed(2),
            feedback,
            submissionId: submission._id
        });

    } catch (err) {
        console.error(err);
        return res.status(500).json({ message: err.message });
    }
};


// GET leaderboard
const getLeaderboard = async (req, res) => {
    try {
        const { groupId } = req.query;
        if (!groupId) return res.status(400).json({ message: "groupId required" });

        let { page = 1, limit = 20, classId, sectionId } = req.query;
        page = Number(page);
        limit = Number(limit);
        const skip = (page - 1) * limit;

        const filter = { groupId: new mongoose.Types.ObjectId(groupId) };

        const pipeline = [
            { $match: filter },
            { $lookup: { from: "users", localField: "studentId", foreignField: "_id", as: "student" } },
            { $unwind: "$student" }
        ];

        if (classId) pipeline.push({ $match: { "student.classInfo.id": mongoose.Types.ObjectId(classId) } });
        if (sectionId) pipeline.push({ $match: { "student.sectionInfo.id": mongoose.Types.ObjectId(sectionId) } });

        pipeline.push({ $sort: { totalMarksObtained: -1, submittedAt: 1 } });
        pipeline.push({ $skip: skip });
        pipeline.push({ $limit: limit });
        pipeline.push({
            $project: {
                _id: 1,
                studentId: 1,
                totalMarksObtained: 1,
                totalMarks: 1,
                submittedAt: 1,
                "student._id": 1,
                "student.name": 1,
                "student.email": 1,
                "student.classInfo": 1,
                "student.sectionInfo": 1
            }
        });

        const results = await QuizSubmission.aggregate(pipeline);
        const total = await QuizSubmission.countDocuments(filter);

        return res.status(200).json({ total, page, totalPages: Math.ceil(total / limit), results });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ message: err.message });
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
