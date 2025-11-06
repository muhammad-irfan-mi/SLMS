const Subject = require("../models/Subject");
const ClassSection = require("../models/ClassSection");
const Schedule = require("../models/Schedule");

const addSubject = async (req, res) => {
  try {
    const schoolId = req.user.school;
    const { name, code, description, classId, sectionId } = req.body;

    console.log("req.body", req.body);

    if (!name || !classId) {
      return res.status(400).json({
        message: "Subject name and classId are required",
      });
    }

    const classDoc = await ClassSection.findById(classId);
    if (!classDoc) {
      return res.status(400).json({ message: "Invalid classId" });
    }

    const existing = await Subject.findOne({
      school: schoolId,
      name: { $regex: new RegExp(`^${name}$`, "i") },
      class: classId,
      sectionId: sectionId || null,
    });

    if (existing) {
      return res.status(400).json({
        message: "Subject with this name already exists in this class and section",
      });
    }

    const subject = await Subject.create({
      name,
      code,
      description,
      school: schoolId,
      class: classId,
      sectionId: sectionId || null,
    });

    res.status(201).json({
      message: "Subject added successfully",
      subject,
    });
  } catch (err) {
    console.error("Error adding subject:", err);
    res.status(500).json({
      message: "Server error",
      error: err.message,
    });
  }
};

const getSubjects = async (req, res) => {
  try {
    const schoolId = req.user.school;
    const { classId, sectionId } = req.query;

    const filter = { school: schoolId };
    if (classId) filter.class = classId;
    if (sectionId) filter.sectionId = sectionId;

    const subjects = await Subject.find(filter)
      .populate("class", "class")
      .sort({ createdAt: -1 });

    res.status(200).json({ subjects });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

const getSubjectsByTeacher = async (req, res) => {
  try {
    const teacherId = req.user._id;
    const schoolId = req.user.school;

    const schedules = await Schedule.find({ school: schoolId, teacherId })
      .populate({
        path: "subjectId",
        select: "name code description class sectionId",
        populate: {
          path: "class",
          select: "class sections",
        },
      })
      .populate("classId", "class sections");

    if (!schedules.length) {
      return res.status(404).json({ message: "No subjects found for this teacher" });
    }

    const uniqueSubjects = [];
    const seen = new Set();

    for (const schedule of schedules) {
      const subject = schedule.subjectId;
      const classDoc = schedule.classId;

      let sectionName = "Unknown";
      if (classDoc && Array.isArray(classDoc.sections)) {
        const foundSection = classDoc.sections.find(
          (sec) => sec._id.toString() === schedule.sectionId.toString()
        );
        if (foundSection) sectionName = foundSection.name;
      }

      if (subject && !seen.has(subject._id.toString())) {
        seen.add(subject._id.toString());
        uniqueSubjects.push({
          _id: subject._id,
          name: subject.name,
          code: subject.code,
          description: subject.description,
          class: classDoc
            ? {
              _id: classDoc._id,
              name: classDoc.class,
            }
            : null,
          section: {
            _id: schedule.sectionId,
            name: sectionName,
          },
        });
      }
    }

    res.status(200).json({
      total: uniqueSubjects.length,
      subjects: uniqueSubjects,
    });
  } catch (error) {
    console.error("Error fetching subjects by teacher:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

const updateSubject = async (req, res) => {
  try {
    const { id } = req.params;
    const updated = await Subject.findByIdAndUpdate(id, req.body, { new: true });
    if (!updated) return res.status(404).json({ message: "Subject not found" });
    res.status(200).json({ message: "Subject updated successfully", subject: updated });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

const deleteSubject = async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await Subject.findByIdAndDelete(id);
    if (!deleted) return res.status(404).json({ message: "Subject not found" });
    res.status(200).json({ message: "Subject deleted successfully" });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

module.exports = { addSubject, getSubjects, getSubjectsByTeacher, updateSubject, deleteSubject };
