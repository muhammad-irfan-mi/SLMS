const Subject = require("../models/Subject");
const ClassSection = require("../models/ClassSection");
const Schedule = require("../models/Schedule");

// const extractClassSection = (subject) => {
//   const response = subject.toObject ? subject.toObject() : { ...subject };

//   // Ensure we have proper nested objects
//   if (!response.class || typeof response.class === 'string') {
//     response.class = {
//       _id: response.class,
//       name: '',
//       sections: []
//     };
//   }

//   if (!response.section || typeof response.section === 'string') {
//     if (response.sectionId) {
//       response.section = {
//         _id: response.sectionId,
//         name: ''
//       };
//     } else {
//       response.section = null;
//     }
//   }

//   // Remove duplicate sectionId if we have section object
//   if (response.section && response.sectionId) {
//     delete response.sectionId;
//   }

//   return response;
// };

//   Get class and section data with validation
const getClassSectionData = async (classId, schoolId, sectionId = null) => {
  try {
    const classDoc = await ClassSection.findOne({
      _id: classId,
      school: schoolId
    }).lean();

    if (!classDoc) {
      return {
        error: {
          status: 400,
          message: "Class not found in your school"
        }
      };
    }

    const response = {
      class: {
        _id: classDoc._id,
        name: classDoc.class
      },
      section: null
    };

    if (sectionId) {
      const foundSection = classDoc.sections.find(
        section => section._id.toString() === sectionId.toString()
      );

      if (!foundSection) {
        return {
          error: {
            status: 400,
            message: "Section does not belong to this class"
          }
        };
      }

      response.section = {
        _id: foundSection._id,
        name: foundSection.name
      };
    }

    return { data: response, classDoc };
  } catch (error) {
    console.error("Error in getClassSectionData:", error);
    return {
      error: {
        status: 500,
        message: "Error fetching class/section data"
      }
    };
  }
};

const addSubject = async (req, res) => {
  try {
    const schoolId = req.user.school;
    const { name, code, description, classId, sectionId } = req.body;

    const classDoc = await ClassSection.findOne({
      _id: classId,
      school: schoolId
    });

    if (!classDoc) {
      return res.status(400).json({
        message: "Class not found in your school"
      });
    }

    if (sectionId) {
      const sectionExists = classDoc.sections.some(
        section => section._id.toString() === sectionId
      );

      if (!sectionExists) {
        return res.status(400).json({
          message: "Section does not belong to this class"
        });
      }
    }

    const existing = await Subject.findOne({
      school: schoolId,
      name: { $regex: new RegExp(`^${name}$`, "i") },
      classId: classId,
      sectionId: sectionId || null,
      isActive: true
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
      classId: classId,
      sectionId: sectionId || null,
      isActive: true
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
    const { classId, sectionId, page = 1, limit = 10 } = req.query;

    const filter = {
      school: schoolId,
      isActive: true
    };

    if (classId) {
      filter.classId = classId;

      if (sectionId) {
        filter.sectionId = sectionId;
      }
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const total = await Subject.countDocuments(filter);

    const subjects = await Subject.find(filter)
      .populate({
        path: "classId",
        select: "classId",
      })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean();
      console.log("subject", subjects)

    const formattedSubjects = await Promise.all(
      subjects.map(async (subject) => {
        const classSectionResult = await getClassSectionData(
          subject.classId,
          schoolId,
          subject.sectionId
        );

        const response = {
          _id: subject._id,
          name: subject.name,
          code: subject.code || null,
          description: subject.description || null,
          school: subject.school,
          createdAt: subject.createdAt,
          updatedAt: subject.updatedAt,
          __v: subject.__v || 0
        };

        if (!classSectionResult.error) {
          response.classInfo = classSectionResult.data.class;
          response.sectionInfo = classSectionResult.data.section;
        }

        return response;
      })
    );

    res.status(200).json({
      total,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil(total / limit),
      count: formattedSubjects.length,
      subjects: formattedSubjects,
    });

  } catch (err) {
    console.error("Error fetching subjects:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

const getSubjectById = async (req, res) => {
  try {
    const { id } = req.params;
    const schoolId = req.user.school;

    const subject = await Subject.findOne({
      _id: id,
      school: schoolId,
      isActive: true
    })
      .populate({
        path: "classId",
        select: "classId",
      })
      .lean();

    if (!subject) {
      return res.status(404).json({
        message: "Subject not found in your school"
      });
    }

    const classSectionResult = await getClassSectionData(
      subject.classId,
      schoolId,
      subject.sectionId
    );

    if (classSectionResult.error) {
      return res.status(classSectionResult.error.status).json({
        message: classSectionResult.error.message
      });
    }

    const response = {
      _id: subject._id,
      name: subject.name,
      code: subject.code || null,
      description: subject.description || null,
      school: subject.school,
      createdAt: subject.createdAt,
      updatedAt: subject.updatedAt,
      __v: subject.__v || 0,
      classInfo: classSectionResult.data.class,
      sectionInfo: classSectionResult.data.section
    };

    res.status(200).json({
      message: "Subject retrieved successfully",
      subject: response,
    });
  } catch (err) {
    console.error("Error fetching subject by ID:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

const getSubjectsByTeacher = async (req, res) => {
  try {
    console.log(req.user)
    const teacherId = req.user._id;
    const schoolId = req.user.school;
    const { page = 1, limit = 20 } = req.query;

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    const schedules = await Schedule.find({
      school: schoolId,
      teacherId
    })
      .populate({
        path: "subjectId",
        select: "name code description class sectionId isActive",
        match: { isActive: true },
        populate: {
          path: "classId",
          select: "classId",
        },
      })
      .populate("classId", "classId")
      .lean();

    if (!schedules.length) {
      return res.status(404).json({
        message: "No subjects found for this teacher"
      });
    }

    const uniqueSubjects = [];
    const seen = new Set();

    for (const schedule of schedules) {
      const subject = schedule.subjectId;
      const classDoc = schedule.classId;

      if (!subject || !classDoc) continue;

      if (!seen.has(subject._id.toString())) {
        seen.add(subject._id.toString());

        const classSectionResult = await getClassSectionData(
          classDoc._id,
          schoolId,
          subject.sectionId || schedule.sectionId
        );

        if (classSectionResult.error) continue;

        const formattedSubject = {
          _id: subject._id,
          name: subject.name,
          code: subject.code || null,
          description: subject.description || null,
          school: subject.school,
          createdAt: subject.createdAt,
          updatedAt: subject.updatedAt,
          __v: subject.__v || 0,
          class: classSectionResult.data.class,
          section: classSectionResult.data.section
        };

        uniqueSubjects.push(formattedSubject);
      }
    }

    const total = uniqueSubjects.length;
    const paginated = uniqueSubjects.slice(skip, skip + limitNum);

    res.status(200).json({
      total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(total / limitNum),
      count: paginated.length,
      subjects: paginated,
    });
  } catch (error) {
    console.error("Error fetching subjects by teacher:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

const updateSubject = async (req, res) => {
  try {
    const { id } = req.params;
    const schoolId = req.user.school;
    const updateData = req.body;

    const subject = await Subject.findOne({
      _id: id,
      school: schoolId,
      isActive: true
    });

    if (!subject) {
      return res.status(404).json({
        message: "Subject not found in your school"
      });
    }

    if (updateData.classId && updateData.classId !== subject.classId.toString()) {
      const classDoc = await ClassSection.findOne({
        _id: updateData.classId,
        school: schoolId
      });

      if (!classDoc) {
        return res.status(400).json({
          message: "Class not found in your school"
        });
      }

      if (updateData.sectionId) {
        const sectionExists = classDoc.sections.some(
          section => section._id.toString() === updateData.sectionId
        );

        if (!sectionExists) {
          return res.status(400).json({
            message: "Section does not belong to this class"
          });
        }
      }
    }

    if (updateData.sectionId && (!updateData.classId || updateData.classId === subject.classId.toString())) {
      const currentClass = await ClassSection.findOne({
        _id: subject.classId,
        school: schoolId
      });

      if (currentClass) {
        const sectionExists = currentClass.sections.some(
          section => section._id.toString() === updateData.sectionId
        );

        if (!sectionExists) {
          return res.status(400).json({
            message: "Section does not belong to this class"
          });
        }
      }
    }

    if (updateData.name && updateData.name !== subject.name) {
      const duplicate = await Subject.findOne({
        school: schoolId,
        name: { $regex: new RegExp(`^${updateData.name}$`, "i") },
        classId: updateData.classId || subject.classId,
        sectionId: updateData.sectionId || subject.sectionId,
        _id: { $ne: id }
      });

      if (duplicate) {
        return res.status(400).json({
          message: "Subject with this name already exists in this class and section",
        });
      }
    }

    const updatedSubject = await Subject.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    ).populate("classId", "classId");

    res.status(200).json({
      message: "Subject updated successfully",
      subject: updatedSubject
    });
  } catch (err) {
    console.error("Error updating subject:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

const deleteSubject = async (req, res) => {
  try {
    const { id } = req.params;
    const schoolId = req.user.school;

    const deleted = await Subject.findByIdAndUpdate(
      {
        _id: id,
        school: schoolId,
        isActive: true
      },
      { isActive: false },
      { new: true }
    );

    if (!deleted) {
      return res.status(404).json({
        message: "Subject not found in your school"
      });
    }

    res.status(200).json({
      message: "Subject deleted successfully"
    });
  } catch (err) {
    console.error("Error deleting subject:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

module.exports = {
  addSubject,
  getSubjects,
  getSubjectById,
  updateSubject,
  deleteSubject,
  getSubjectsByTeacher,
};