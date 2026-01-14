const ClassSection = require("../models/ClassSection");

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


module.exports = {
    getClassSectionData
}