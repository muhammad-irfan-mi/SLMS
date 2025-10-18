const Subject = require("../models/Subject");
const ClassSection = require("../models/ClassSection");

const addSubject = async (req, res) => {
  try {
    const schoolId = req.user.school;
    const { name, code, description, classId, sectionId } = req.body;
    console.log('req.body', req.body)

    if (!name || !classId)
      return res.status(400).json({ message: "Subject name and classId are required" });

    const classDoc = await ClassSection.findById(classId);
    if (!classDoc) return res.status(400).json({ message: "Invalid classId" });

    const subject = await Subject.create({
      name,
      code,
      description,
      school: schoolId,
      class: classId,
      sectionId,
    });

    res.status(201).json({ message: "Subject added successfully", subject });
  } catch (err) {
    console.error("Error adding subject:", err);
    res.status(500).json({ message: "Server error", error: err.message });
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

module.exports = { addSubject, getSubjects, updateSubject, deleteSubject };
