const Joi = require('joi');

const addSubjectValidation = Joi.object({
  name: Joi.string().trim().required().min(2).max(100).messages({
    'string.base': 'Subject name must be a string',
    'string.empty': 'Subject name cannot be empty',
    'string.min': 'Subject name must be at least 2 characters long',
    'string.max': 'Subject name cannot exceed 100 characters',
    'any.required': 'Subject name is required',
  }),
  code: Joi.string().trim().allow('', null).max(20).optional().messages({
    'string.base': 'Subject code must be a string',
    'string.max': 'Subject code cannot exceed 20 characters',
  }),
  description: Joi.string().trim().allow('', null).max(500).optional().messages({
    'string.base': 'Description must be a string',
    'string.max': 'Description cannot exceed 500 characters',
  }),
  classId: Joi.string().hex().length(24).required().messages({
    'string.hex': 'Class ID must be a valid hexadecimal string',
    'string.length': 'Class ID must be 24 characters long',
    'any.required': 'Class ID is required',
  }),
  sectionId: Joi.string().hex().length(24).allow('', null).optional().messages({
    'string.hex': 'Section ID must be a valid hexadecimal string',
    'string.length': 'Section ID must be 24 characters long',
  }),
});

const updateSubjectValidation = Joi.object({
  name: Joi.string().trim().min(2).max(100).optional().messages({
    'string.base': 'Subject name must be a string',
    'string.min': 'Subject name must be at least 2 characters long',
    'string.max': 'Subject name cannot exceed 100 characters',
  }),
  code: Joi.string().trim().allow('', null).max(20).optional().messages({
    'string.base': 'Subject code must be a string',
    'string.max': 'Subject code cannot exceed 20 characters',
  }),
  description: Joi.string().trim().allow('', null).max(500).optional().messages({
    'string.base': 'Description must be a string',
    'string.max': 'Description cannot exceed 500 characters',
  }),
  classId: Joi.string().hex().length(24).optional().messages({
    'string.hex': 'Class ID must be a valid hexadecimal string',
    'string.length': 'Class ID must be 24 characters long',
  }),
  sectionId: Joi.string().hex().length(24).allow('', null).optional().messages({
    'string.hex': 'Section ID must be a valid hexadecimal string',
    'string.length': 'Section ID must be 24 characters long',
  }),
});

const getSubjectsValidation = Joi.object({
  classId: Joi.string().hex().length(24).optional().messages({
    'string.hex': 'Class ID must be a valid hexadecimal string',
    'string.length': 'Class ID must be 24 characters long',
  }),
  sectionId: Joi.string().hex().length(24).optional().messages({
    'string.hex': 'Section ID must be a valid hexadecimal string',
    'string.length': 'Section ID must be 24 characters long',
  }),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(10),
});

const getSubjectsByTeacherValidation = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
});

const idParamValidation = Joi.object({
  id: Joi.string().hex().length(24).required().messages({
    'string.hex': 'Subject ID must be a valid hexadecimal string',
    'string.length': 'Subject ID must be 24 characters long',
    'any.required': 'Subject ID is required',
  }),
});

module.exports = {
  addSubjectValidation,
  updateSubjectValidation,
  getSubjectsValidation,
  getSubjectsByTeacherValidation,
  idParamValidation,
};