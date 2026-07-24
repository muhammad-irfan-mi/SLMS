const Joi = require("joi");
const mongoose = require("mongoose");

const objectId = Joi.string().custom((value, helpers) => {
  if (!mongoose.Types.ObjectId.isValid(value)) {
    return helpers.error("any.invalid");
  }
  return value;
});

const subjectSchema = Joi.object({
  subjectId: objectId.required(),
  obtainedMarks: Joi.number()
    .min(0)
    .required(),
  remarks: Joi.string()
    .allow("")
    .optional()
});

const addResultSchema = Joi.object({

  studentId: objectId.required(),

  classId: objectId.required(),

  sectionId: objectId.required(),

  examType: Joi.string()
    .valid(
      "midterm",
      "midterm2",
      "final"
    )
    .required(),

  year: Joi.number()
    .integer()
    .min(2024)
    .max(new Date().getFullYear() + 1)
    .required(),

  subjects: Joi.array()
    .items(subjectSchema)
    .min(1)
    .required(),

  remarks: Joi.string()
    .allow("")
    .optional()

});

const updateResultSchema = Joi.object({

  examType: Joi.string()
    .valid(
      "midterm",
      "midterm2",
      "final"
    ),

  year: Joi.number()
    .integer()
    .min(2024)
    .max(new Date().getFullYear() + 1),

  subjects: Joi.array()
    .items(subjectSchema)
    .min(1),

  remarks: Joi.string()
    .allow("")

}).min(1);

const resultIdParamSchema = Joi.object({

  resultId: objectId.required()

}).unknown(true);

const getResultsSchema = Joi.object({

  studentId: objectId,

  classId: objectId,

  sectionId: objectId,

  examType: Joi.string().valid(
    "midterm",
    "midterm2",
    "final"
  ),

  year: Joi.number(),

  search: Joi.string(),

  page: Joi.number()
    .default(1),

  limit: Joi.number()
    .default(10)

});

const getAllResultsSchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),

  limit: Joi.number().integer().min(1).max(100).default(20),

  studentId: objectId,

  classId: objectId,

  sectionId: objectId,

  year: Joi.number()
    .integer()
    .min(2000)
    .max(new Date().getFullYear() + 1),

  examType: Joi.string().valid(
    "midterm",
    "midterm2",
    "final"
  ),

  latest: Joi.boolean().default(false),

  search: Joi.string().trim().allow(""),

  sortBy: Joi.string()
    .valid(
      "createdAt",
      "year",
      "percentage",
      "studentName"
    )
    .default("createdAt"),

  sortOrder: Joi.string()
    .valid("asc", "desc")
    .default("desc")
});

module.exports = {
  addResultSchema,
  updateResultSchema,
  resultIdParamSchema,
  getResultsSchema,
  getAllResultsSchema
};