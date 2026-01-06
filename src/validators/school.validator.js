const Joi = require('joi');

// Common validation patterns
const namePattern = /^[A-Za-z0-9\s.,'&-]{3,150}$/;
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const passwordPattern = /^(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#])[A-Za-z\d@$!%*?&#]{8,20}$/;
const cnicPattern = /^\d{5}-\d{7}-\d{1}$/;
const phonePattern = /^[0-9+]{10,15}$/;

// Common validation schemas
const commonValidations = {
  name: Joi.string()
    .pattern(namePattern)
    .min(3)
    .max(150)
    .trim()
    .required()
    .messages({
      'string.pattern.base': 'School name contains invalid characters',
      'string.empty': 'School name is required',
      'string.min': 'School name must be at least 3 characters',
      'string.max': 'School name must not exceed 150 characters',
      'any.required': 'School name is required'
    }),

  email: Joi.string()
    .pattern(emailPattern)
    .email({ tlds: { allow: false } })
    .trim()
    .lowercase()
    .required()
    .messages({
      'string.pattern.base': 'Invalid email format',
      'string.email': 'Invalid email format',
      'string.empty': 'Email is required',
      'any.required': 'Email is required'
    }),

  password: Joi.string()
    .pattern(passwordPattern)
    .min(8)
    .max(20)
    .required()
    .messages({
      'string.pattern.base': 'Password must contain at least 1 uppercase letter, 1 number, and 1 special character (@$!%*?&#)',
      'string.empty': 'Password is required',
      'string.min': 'Password must be at least 8 characters',
      'string.max': 'Password must not exceed 20 characters',
      'any.required': 'Password is required'
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

  lat: Joi.alternatives()
    .try(
      Joi.number().min(-90).max(90),
      Joi.string().allow('', null)
    )
    .optional()
    .messages({
      'number.min': 'Latitude must be between -90 and 90',
      'number.max': 'Latitude must be between -90 and 90'
    }),

  lon: Joi.alternatives()
    .try(
      Joi.number().min(-180).max(180),
      Joi.string().allow('', null)
    )
    .optional()
    .messages({
      'number.min': 'Longitude must be between -180 and 180',
      'number.max': 'Longitude must be between -180 and 180'
    }),

  noOfStudents: Joi.alternatives()
    .try(
      Joi.number().integer().min(0),
      Joi.string().allow('', null)
    )
    .optional()
    .default(0)
    .messages({
      'number.min': 'Number of students cannot be negative',
      'number.integer': 'Number of students must be an integer'
    }),
};

// Validation schemas
const validationSchemas = {
  // Add school schema
  addSchool: Joi.object({
    name: commonValidations.name,
    email: commonValidations.email,
    phone: commonValidations.phone,
    address: commonValidations.address,
    cnic: commonValidations.cnic,
    lat: commonValidations.lat,
    lon: commonValidations.lon,
    noOfStudents: commonValidations.noOfStudents
  }),

  // Update school schema
  updateSchool: Joi.object({
    name: commonValidations.name.optional(),
    email: commonValidations.email.optional(),
    phone: commonValidations.phone,
    address: commonValidations.address,
    cnic: commonValidations.cnic,
    lat: commonValidations.lat,
    lon: commonValidations.lon,
    noOfStudents: commonValidations.noOfStudents
  }),

  verifyOTP: Joi.object({
    email: commonValidations.email,
    otp: Joi.string()
      .pattern(/^\d{6}$/)
      .required()
      .messages({
        'string.pattern.base': 'OTP must be a 6-digit number',
        'string.empty': 'OTP is required',
        'any.required': 'OTP is required'
      })
  }),

  // Resend OTP schema
  resendOTP: Joi.object({
    email: commonValidations.email
  }),

  // Set password schema
  // setPassword: Joi.object({
  //   email: commonValidations.email,
  //   password: commonValidations.password
  // }),

  setPassword: Joi.object({
    email: commonValidations.email,
    // schoolId: Joi.string()
    //   .required()
    //   .messages({
    //     'string.empty': 'School ID is required',
    //     'any.required': 'School ID is required'
    //   }),
    password: commonValidations.password,
    // confirmPassword: Joi.string()
    //   .valid(Joi.ref('password'))
    //   .required()
    //   .messages({
    //     'any.only': 'Passwords do not match',
    //     'any.required': 'Confirm password is required'
    //   })
  }),

  // Login schema
  login: Joi.object({
    email: commonValidations.email,
    password: commonValidations.password
  }),

  // ID param schema
  idParam: Joi.object({
    id: Joi.string()
      .pattern(/^[0-9a-fA-F]{24}$/)
      .required()
      .messages({
        'string.pattern.base': 'Invalid school ID format',
        'string.empty': 'School ID is required',
        'any.required': 'School ID is required'
      })
  }),

  // Pagination query schema
  paginationQuery: Joi.object({
    page: Joi.alternatives()
      .try(
        Joi.number().integer().min(1),
        Joi.string()
      )
      .default(1)
      .optional(),
    limit: Joi.alternatives()
      .try(
        Joi.number().integer().min(1).max(100),
        Joi.string()
      )
      .default(20)
      .optional()
  })
};

module.exports = {
  validationSchemas
};