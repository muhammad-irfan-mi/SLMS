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

const getClassSectionMaps = async (students = [], schoolId) => {

  const classIds = [
    ...new Set(
      students
        .map(student => student.classInfo?.id?.toString())
        .filter(Boolean)
    )
  ];

  if (!classIds.length) {
    return {
      classMap: new Map(),
      sectionMap: new Map()
    };
  }

  const classSections = await ClassSection.find({
    school: schoolId,
    _id: { $in: classIds }
  })
    .select("class sections")
    .lean();

  const classMap = new Map();
  const sectionMap = new Map();

  for (const classDoc of classSections) {

    classMap.set(classDoc._id.toString(), {
      id: classDoc._id,
      name: classDoc.class
    });

    for (const section of classDoc.sections) {

      sectionMap.set(section._id.toString(), {
        id: section._id,
        name: section.name
      });

    }

  }

  return {
    classMap,
    sectionMap
  };

};


const formatClassSection = (
  student,
  classMap,
  sectionMap
) => {

  return {

    classInfo: student.classInfo?.id
      ? classMap.get(student.classInfo.id.toString()) || null
      : null,

    sectionInfo: student.sectionInfo?.id
      ? sectionMap.get(student.sectionInfo.id.toString()) || null
      : null

  };

};


module.exports = {
  getClassSectionData,
  getClassSectionMaps,
  formatClassSection
}