const Joi = require('joi');
const mongoose = require('mongoose');

const resultIdParamSchema = Joi.object({
  resultId: Joi.string().custom((value, helpers) => {
    if (!mongoose.Types.ObjectId.isValid(value)) {
      return helpers.error('any.invalid');
    }
    return value;
  }).required()
}).unknown(true);

const studentIdParamSchema = Joi.object({
  studentId: Joi.string().custom((value, helpers) => {
    if (!mongoose.Types.ObjectId.isValid(value)) {
      return helpers.error('any.invalid');
    }
    return value;
  }).required()
}).unknown(true);

const addResultSchema = Joi.object({
  studentId: Joi.string()
    .custom((value, helpers) => {
      if (!mongoose.Types.ObjectId.isValid(value)) {
        return helpers.error('any.invalid');
      }
      return value;
    })
    .required()
    .messages({
      'any.required': 'Student ID is required',
      'any.invalid': 'Invalid student ID format'
    }),
  classId: Joi.string()
    .custom((value, helpers) => {
      if (!mongoose.Types.ObjectId.isValid(value)) {
        return helpers.error('any.invalid');
      }
      return value;
    })
    .required()
    .messages({
      'any.required': 'Class ID is required',
      'any.invalid': 'Invalid class ID format'
    }),
  sectionId: Joi.string()
    .custom((value, helpers) => {
      if (!mongoose.Types.ObjectId.isValid(value)) {
        return helpers.error('any.invalid');
      }
      return value;
    })
    .required()
    .messages({
      'any.required': 'Section ID is required',
      'any.invalid': 'Invalid section ID format'
    }),
  marksObtained: Joi.number()
    .min(0)
    .max(1000)
    .required()
    .messages({
      'number.base': 'Marks must be a number',
      'number.min': 'Marks cannot be negative',
      'number.max': 'Marks cannot exceed 1000',
      'any.required': 'Marks obtained is required'
    }),
  totalMarks: Joi.number()
    .min(1)
    .max(1000)
    .required()
    .messages({
      'number.base': 'Total marks must be a number',
      'number.min': 'Total marks must be at least 1',
      'number.max': 'Total marks cannot exceed 1000',
      'any.required': 'Total marks is required'
    }),
  position: Joi.string()
    .valid('first', 'second', 'third', 'pass', 'fail')
    .required()
    .messages({
      'any.only': 'Position must be one of: first, second, third, pass, fail',
      'any.required': 'Position is required'
    }),
  examType: Joi.string()
    .valid('midterm', 'midterm2', 'final')
    .required()
    .messages({
      'any.only': 'Exam type must be one of: midterm, midterm2, final',
      'any.required': 'Exam type is required'
    }),
  year: Joi.number()
    .integer()
    .min(2000)
    .max(new Date().getFullYear() + 1)
    .required()
    .messages({
      'number.base': 'Year must be a number',
      'number.integer': 'Year must be an integer',
      'number.min': 'Year cannot be before 2000',
      'number.max': 'Year cannot be in the future',
      'any.required': 'Year is required'
    })
}).custom((data, helpers) => {
  if (data.marksObtained > data.totalMarks) {
    return helpers.message('Marks obtained cannot be greater than total marks');
  }
  return data;
});

const updateResultSchema = Joi.object({
  studentId: Joi.string()
    .custom((value, helpers) => {
      if (!mongoose.Types.ObjectId.isValid(value)) {
        return helpers.error('any.invalid');
      }
      return value;
    })
    .messages({
      'any.invalid': 'Invalid student ID format'
    }),
  classId: Joi.string()
    .custom((value, helpers) => {
      if (!mongoose.Types.ObjectId.isValid(value)) {
        return helpers.error('any.invalid');
      }
      return value;
    })
    .messages({
      'any.invalid': 'Invalid class ID format'
    }),
  sectionId: Joi.string()
    .custom((value, helpers) => {
      if (!mongoose.Types.ObjectId.isValid(value)) {
        return helpers.error('any.invalid');
      }
      return value;
    })
    .messages({
      'any.invalid': 'Invalid section ID format'
    }),
  marksObtained: Joi.number()
    .min(0)
    .max(1000)
    .messages({
      'number.base': 'Marks must be a number',
      'number.min': 'Marks cannot be negative',
      'number.max': 'Marks cannot exceed 1000'
    }),
  totalMarks: Joi.number()
    .min(1)
    .max(1000)
    .messages({
      'number.base': 'Total marks must be a number',
      'number.min': 'Total marks must be at least 1',
      'number.max': 'Total marks cannot exceed 1000'
    }),
  position: Joi.string()
    .valid('first', 'second', 'third', 'pass', 'fail')
    .messages({
      'any.only': 'Position must be one of: first, second, third, pass, fail'
    }),
  examType: Joi.string()
    .valid('midterm', 'midterm2', 'final')
    .messages({
      'any.only': 'Exam type must be one of: midterm, midterm2, final'
    }),
  year: Joi.number()
    .integer()
    .min(2000)
    .max(new Date().getFullYear() + 1)
    .messages({
      'number.base': 'Year must be a number',
      'number.integer': 'Year must be an integer',
      'number.min': 'Year cannot be before 2000',
      'number.max': 'Year cannot be in the future'
    })
}).custom((data, helpers) => {
  if (data.marksObtained !== undefined && data.totalMarks !== undefined) {
    if (data.marksObtained > data.totalMarks) {
      return helpers.message('Marks obtained cannot be greater than total marks');
    }
  }
  return data;
}).min(1);

const getResultsQuerySchema = Joi.object({
  studentId: Joi.string()
    .custom((value, helpers) => {
      if (!mongoose.Types.ObjectId.isValid(value)) {
        return helpers.error('any.invalid');
      }
      return value;
    })
    .messages({
      'any.invalid': 'Invalid student ID format'
    }),
  classId: Joi.string()
    .custom((value, helpers) => {
      if (!mongoose.Types.ObjectId.isValid(value)) {
        return helpers.error('any.invalid');
      }
      return value;
    })
    .messages({
      'any.invalid': 'Invalid class ID format'
    }),
  sectionId: Joi.string()
    .custom((value, helpers) => {
      if (!mongoose.Types.ObjectId.isValid(value)) {
        return helpers.error('any.invalid');
      }
      return value;
    })
    .messages({
      'any.invalid': 'Invalid section ID format'
    }),
  examType: Joi.string()
    .valid('midterm', 'midterm2', 'final')
    .messages({
      'any.only': 'Exam type must be one of: midterm, midterm2, final'
    }),
  year: Joi.number()
    .integer()
    .min(2000)
    .max(new Date().getFullYear() + 1)
    .messages({
      'number.base': 'Year must be a number',
      'number.integer': 'Year must be an integer',
      'number.min': 'Year cannot be before 2000',
      'number.max': 'Year cannot be in the future'
    }),
  position: Joi.string()
    .valid('first', 'second', 'third', 'pass', 'fail')
    .messages({
      'any.only': 'Position must be one of: first, second, third, pass, fail'
    }),
  page: Joi.number()
    .integer()
    .min(1)
    .default(1),
  limit: Joi.number()
    .integer()
    .min(1)
    .max(100)
    .default(10)
});

const getResultsByPositionQuerySchema = Joi.object({
  examType: Joi.string()
    .valid('midterm', 'midterm2', 'final')
    .messages({
      'any.only': 'Exam type must be one of: midterm, midterm2, final'
    }),
  year: Joi.number()
    .integer()
    .min(2000)
    .max(new Date().getFullYear() + 1)
    .messages({
      'number.base': 'Year must be a number',
      'number.integer': 'Year must be an integer',
      'number.min': 'Year cannot be before 2000',
      'number.max': 'Year cannot be in the future'
    }),
  classId: Joi.string()
    .custom((value, helpers) => {
      if (!mongoose.Types.ObjectId.isValid(value)) {
        return helpers.error('any.invalid');
      }
      return value;
    })
    .messages({
      'any.invalid': 'Invalid class ID format'
    }),
  sectionId: Joi.string()
    .custom((value, helpers) => {
      if (!mongoose.Types.ObjectId.isValid(value)) {
        return helpers.error('any.invalid');
      }
      return value;
    })
    .messages({
      'any.invalid': 'Invalid section ID format'
    })
});

module.exports = {
  resultIdParamSchema,
  studentIdParamSchema,
  addResultSchema,
  updateResultSchema,
  getResultsQuerySchema,
  getResultsByPositionQuerySchema
};