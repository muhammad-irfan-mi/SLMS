const Joi = require('joi');

// Exact regex patterns from your code
const namePattern = /^[A-Za-z0-9\s.'-]{2,50}$/;
const usernamePattern = /^[a-zA-Z0-9._-]{3,30}$/;
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const passwordPattern = /^(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#])[A-Za-z\d@$!%*?&#]{8,20}$/;
const cnicPattern = /^\d{5}-\d{7}-\d{1}$/;
const phonePattern = /^[0-9+]{10,15}$/;

// Common validation schemas
const commonValidations = {
  name: Joi.string()
    .pattern(namePattern)
    .min(2)
    .max(50)
    .required()
    .messages({
      'string.pattern.base': 'Name contains invalid characters',
      'string.empty': 'Name is required',
      'string.min': 'Name must be at least 2 characters long',
      'string.max': 'Name must not exceed 50 characters'
    }),

  username: Joi.string()
    .pattern(usernamePattern)
    .min(3)
    .max(20)
    .lowercase()
    .required()
    .messages({
      'string.pattern.base': 'Username can only contain letters, numbers, dots, hyphens, and underscores',
      'string.empty': 'Username is required',
      'string.min': 'Username must be at least 3 characters long',
      'string.max': 'Username must not exceed 20 characters'
    }),

  email: Joi.string()
    .pattern(emailPattern)
    .email({ tlds: { allow: false } })
    .required()
    .messages({
      'string.pattern.base': 'Invalid email format',
      'string.email': 'Invalid email format',
      'string.empty': 'Email is required'
    }),

  password: Joi.string()
    .pattern(passwordPattern)
    .min(8)
    .max(20)
    .required()
    .messages({
      'string.pattern.base': 'Password must contain at least 1 uppercase letter, 1 number, and 1 special character (@$!%*?&#)',
      'string.empty': 'Password is required',
      'string.min': 'Password must be at least 8 characters long',
      'string.max': 'Password must not exceed 20 characters'
    }),

  cnic: Joi.string()
    .pattern(cnicPattern)
    .allow('', null)
    .optional()
    .messages({
      'string.pattern.base': 'Invalid CNIC format. Use: xxxxx-xxxxxxx-x'
    }),

  phone: Joi.string()
    .pattern(phonePattern)
    .allow('', null)
    .optional()
    .messages({
      'string.pattern.base': 'Phone number must be 10-15 digits'
    }),

  address: Joi.string()
    .max(500)
    .allow('', null)
    .optional(),

  classId: Joi.string()
    .pattern(/^[0-9a-fA-F]{24}$/)
    .required()
    .messages({
      'string.pattern.base': 'Invalid class ID format',
      'string.empty': 'Class ID is required'
    }),

  sectionId: Joi.string()
    .pattern(/^[0-9a-fA-F]{24}$/)
    .required()
    .messages({
      'string.pattern.base': 'Invalid section ID format',
      'string.empty': 'Section ID is required'
    }),

  fatherName: Joi.string()
    .pattern(namePattern)
    .min(2)
    .max(50)
    .allow('', null)
    .optional()
    .messages({
      'string.pattern.base': 'Father name contains invalid characters',
      'string.min': 'Father name must be at least 2 characters long',
      'string.max': 'Father name must not exceed 50 characters'
    }),

  rollNo: Joi.string()
    .max(20)
    .allow('', null)
    .optional(),

  otp: Joi.string()
    .pattern(/^\d{6}$/)
    .required()
    .messages({
      'string.pattern.base': 'OTP must be a 6-digit number',
      'string.empty': 'OTP is required',
      'any.required': 'OTP is required'
    }),

  nameOptional: Joi.string()
    .pattern(namePattern)
    .min(2)
    .max(50)
    .optional()
    .messages({
      'string.pattern.base': 'Name contains invalid characters',
      'string.min': 'Name must be at least 2 characters long',
      'string.max': 'Name must not exceed 50 characters'
    }),

  usernameOptional: Joi.string()
    .pattern(usernamePattern)
    .min(3)
    .max(20)
    .lowercase()
    .optional()
    .messages({
      'string.pattern.base': 'Username can only contain letters, numbers, dots, hyphens, and underscores',
      'string.min': 'Username must be at least 3 characters long',
      'string.max': 'Username must not exceed 20 characters'
    }),

  emailOptional: Joi.string()
    .pattern(emailPattern)
    .email({ tlds: { allow: false } })
    .optional()
    .messages({
      'string.pattern.base': 'Invalid email format',
      'string.email': 'Invalid email format'
    }),

  classIdOptional: Joi.string()
    .pattern(/^[0-9a-fA-F]{24}$/)
    .optional()
    .messages({
      'string.pattern.base': 'Invalid class ID format'
    }),

  sectionIdOptional: Joi.string()
    .pattern(/^[0-9a-fA-F]{24}$/)
    .optional()
    .messages({
      'string.pattern.base': 'Invalid section ID format'
    }),

  idParam: Joi.object({
    id: Joi.string()
      .pattern(/^[0-9a-fA-F]{24}$/)
      .required()
      .messages({
        'string.pattern.base': 'Invalid ID format',
        'string.empty': 'ID is required'
      })
  }),

  sectionParam: Joi.object({
    sectionId: Joi.string()
      .pattern(/^[0-9a-fA-F]{24}$/)
      .required()
      .messages({
        'string.pattern.base': 'Invalid section ID format',
        'string.empty': 'Section ID is required'
      })
  }),

  emailParam: Joi.object({
    email: Joi.string()
      .pattern(emailPattern)
      .email({ tlds: { allow: false } })
      .required()
      .messages({
        'string.pattern.base': 'Invalid email format',
        'string.email': 'Invalid email format',
        'string.empty': 'Email is required'
      })
  })
};

module.exports = { commonValidations };