const Joi = require('joi');

const sectionSchema = Joi.object({
  name: Joi.string().trim().required().messages({
    'string.base': 'Section name must be a string',
    'string.empty': 'Section name cannot be empty',
    'any.required': 'Section name is required',
  }),
});

const classWithSectionsSchema = Joi.object({
  className: Joi.string().trim().required().messages({
    'string.base': 'Class name must be a string',
    'string.empty': 'Class name cannot be empty',
    'any.required': 'Class name is required',
  }),
  sections: Joi.array().items(Joi.string().trim().required()).min(1).required().messages({
    'array.base': 'Sections must be an array',
    'array.min': 'At least one section is required',
    'any.required': 'Sections are required',
  }),
});

const addMultipleClassesValidation = Joi.object({
  schoolId: Joi.string().hex().length(24).required().messages({
    'string.hex': 'School ID must be a valid hexadecimal string',
    'string.length': 'School ID must be 24 characters long',
    'any.required': 'School ID is required',
  }),
  classes: Joi.array().items(classWithSectionsSchema).min(1).required().messages({
    'array.base': 'Classes must be an array',
    'array.min': 'At least one class is required',
    'any.required': 'Classes are required',
  }),
});

const updateAllClassesValidation = Joi.object({
  schoolId: Joi.string().hex().length(24).required().messages({
    'string.hex': 'School ID must be a valid hexadecimal string',
    'string.length': 'School ID must be 24 characters long',
    'any.required': 'School ID is required',
  }),
  classes: Joi.array().items(classWithSectionsSchema).min(0).required().messages({
    'array.base': 'Classes must be an array',
    'any.required': 'Classes are required',
  }),
});

const deleteSectionValidation = Joi.object({
  classId: Joi.string().hex().length(24).required().messages({
    'string.hex': 'Class ID must be a valid hexadecimal string',
    'string.length': 'Class ID must be 24 characters long',
    'any.required': 'Class ID is required',
  }),
  sectionName: Joi.string().trim().required().messages({
    'string.base': 'Section name must be a string',
    'string.empty': 'Section name cannot be empty',
    'any.required': 'Section name is required',
  }),
});

const assignInchargeValidation = Joi.object({
  classId: Joi.string().hex().length(24).required().messages({
    'string.hex': 'Class ID must be a valid hexadecimal string',
    'string.length': 'Class ID must be 24 characters long',
    'any.required': 'Class ID is required',
  }),
  sectionId: Joi.string().hex().length(24).required().messages({
    'string.hex': 'Section ID must be a valid hexadecimal string',
    'string.length': 'Section ID must be 24 characters long',
    'any.required': 'Section ID is required',
  }),
  teacherId: Joi.string().hex().length(24).required().messages({
    'string.hex': 'Teacher ID must be a valid hexadecimal string',
    'string.length': 'Teacher ID must be 24 characters long',
    'any.required': 'Teacher ID is required',
  }),
});

const paginationQueryValidation = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
});

const idParamValidation = Joi.object({
  id: Joi.string().hex().length(24).required().messages({
    'string.hex': 'ID must be a valid hexadecimal string',
    'string.length': 'ID must be 24 characters long',
    'any.required': 'ID is required',
  }),
});

const schoolIdParamValidation = Joi.object({
  schoolId: Joi.string().hex().length(24).required().messages({
    'string.hex': 'School ID must be a valid hexadecimal string',
    'string.length': 'School ID must be 24 characters long',
    'any.required': 'School ID is required',
  }),
});

module.exports = {
  addMultipleClassesValidation,
  updateAllClassesValidation,
  deleteSectionValidation,
  assignInchargeValidation,
  paginationQueryValidation,
  idParamValidation,
  schoolIdParamValidation,
};