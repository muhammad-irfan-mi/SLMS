const Joi = require("joi");
const mongoose = require("mongoose");

const objectId = Joi.string().custom((value, helpers) => {
    if (!mongoose.Types.ObjectId.isValid(value))
        return helpers.message("Invalid ObjectId");
    return value;
});

exports.markAttendanceSchema = Joi.object({
    classId: objectId.required(),
    sectionId: objectId.required(),
    date: Joi.string().optional(), 
    students: Joi.array().items(
        Joi.object({
            studentId: objectId.required(),
            status: Joi.string().valid("present", "absent", "leave").optional()
        })
    ).min(1).required()
});

exports.updateAttendanceSchema = Joi.object({
    students: Joi.array().items(
        Joi.object({
            studentId: objectId.required(),
            status: Joi.string().valid("present", "absent", "leave").required()
        })
    ).min(1).required()
});

exports.paginationSchema = Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(20)
});

exports.dateFilterSchema = Joi.object({
    date: Joi.string().optional(),
    startDate: Joi.string().optional(),
    endDate: Joi.string().optional()
}).xor("date", "startDate");

exports.studentAttendanceQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),

  date: Joi.string().optional(),
  startDate: Joi.string().optional(),
  endDate: Joi.string().optional(),

  status: Joi.string().valid("present", "absent", "leave").optional()
})
.oxor("date", "startDate")
.with("startDate", "endDate");