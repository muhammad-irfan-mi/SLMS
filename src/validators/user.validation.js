const Joi = require('joi');

// Common validation patterns
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

  role: Joi.string()
    .valid('superadmin', 'admin_office', 'teacher', 'student')
    .required(),

  classId: Joi.string()
    .pattern(/^[0-9a-fA-F]{24}$/)
    .allow('', null)
    .optional()
    .messages({
      'string.pattern.base': 'Invalid class ID format'
    }),

  sectionId: Joi.string()
    .pattern(/^[0-9a-fA-F]{24}$/)
    .allow('', null)
    .optional()
    .messages({
      'string.pattern.base': 'Invalid section ID format'
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
    .optional()
};

// Validation schemas
const validationSchemas = {
  // Employee (Teacher/Admin Office) schemas
  addEmployee: Joi.object({
    name: commonValidations.name,
    email: commonValidations.email,
    phone: commonValidations.phone,
    address: commonValidations.address,
    cnic: commonValidations.cnic,
    role: Joi.string()
      .valid('teacher', 'admin_office')
      .required()
      .messages({
        'any.only': 'Role must be either teacher or admin_office',
        'string.empty': 'Role is required'
      }),
    salary: Joi.number()
      .positive()
      .allow('', null)
      .optional()
      .messages({
        'number.positive': 'Salary must be a positive number'
      }),
    joiningDate: Joi.date()
      .iso()
      .max('now')
      .allow('', null)
      .optional()
      .messages({
        'date.format': 'Joining date must be in ISO format (YYYY-MM-DD)',
        'date.max': 'Joining date cannot be in the future'
      }),
    isIncharge: Joi.boolean()
      .default(false)
      .optional(),
    classId: commonValidations.classId,
    sectionId: commonValidations.sectionId
  }),

  updateEmployee: Joi.object({
    name: commonValidations.name.optional(),
    email: commonValidations.email.optional(),
    phone: commonValidations.phone,
    address: commonValidations.address,
    cnic: commonValidations.cnic,
    salary: Joi.number()
      .positive()
      .allow('', null)
      .optional(),
    joiningDate: Joi.date()
      .iso()
      .max('now')
      .allow('', null)
      .optional(),
    isIncharge: Joi.boolean()
      .optional(),
    classId: commonValidations.classId,
    sectionId: commonValidations.sectionId,
    password: commonValidations.password.optional()
  }),

  // Student schemas - email can be duplicate for students
  addStudent: Joi.object({
    name: commonValidations.name,
    username: commonValidations.username,
    email: commonValidations.email,
    phone: commonValidations.phone,
    address: commonValidations.address,
    cnic: commonValidations.cnic,
    fatherName: commonValidations.fatherName,
    classId: commonValidations.classId.required(),
    sectionId: commonValidations.sectionId.required(),
    rollNo: commonValidations.rollNo
  }),

  updateStudent: Joi.object({
    name: commonValidations.name.optional(),
    username: commonValidations.username.optional(),
    email: commonValidations.email.optional(),
    phone: commonValidations.phone,
    address: commonValidations.address,
    cnic: commonValidations.cnic,
    fatherName: commonValidations.fatherName,
    classId: commonValidations.classId,
    sectionId: commonValidations.sectionId,
    rollNo: commonValidations.rollNo,
    password: commonValidations.password.optional()
  }),

  // Profile update schema
  updateProfile: Joi.object({
    name: commonValidations.name.optional(),
    username: commonValidations.username.optional(),
    email: commonValidations.email.optional(),
    phone: commonValidations.phone,
    address: commonValidations.address,
    cnic: commonValidations.cnic,
    fatherName: commonValidations.fatherName,
    salary: Joi.number()
      .positive()
      .allow('', null)
      .optional(),
    joiningDate: Joi.date()
      .iso()
      .max('now')
      .allow('', null)
      .optional(),
    rollNo: commonValidations.rollNo
  }),

  sendOTP: Joi.object({
    email: commonValidations.email,
    username: Joi.string().optional() // Only for students
  }).when(Joi.object({ role: Joi.string().valid('student') }).unknown(), {
    then: Joi.object({
      username: commonValidations.username.required()
    }),
    otherwise: Joi.object({
      username: Joi.string().optional()
    })
  }),

  // Verify OTP schema
  verifyOTP: Joi.object({
    email: commonValidations.email,
    otp: Joi.string()
      .pattern(/^\d{6}$/)
      .required()
      .messages({
        'string.pattern.base': 'OTP must be a 6-digit number',
        'string.empty': 'OTP is required',
        'any.required': 'OTP is required'
      }),
    username: Joi.string().optional()
  }),
  // .when(Joi.object({ role: Joi.string().valid('student') }).unknown(), {
  //   then: Joi.object({
  //     username: commonValidations.username.required()
  //   }),
  //   otherwise: Joi.object({
  //     username: Joi.string().optional()
  //   })
  // }),

  // Resend OTP schema
  resendOTP: Joi.object({
    email: commonValidations.email,
    username: Joi.string().optional()
  }),
  // .when(Joi.object({ role: Joi.string().valid('student') }).unknown(), {
  //   then: Joi.object({
  //     username: commonValidations.username.required()
  //   }),
  //   otherwise: Joi.object({
  //     username: Joi.string().optional()
  //   })
  // }),

  // Set password after OTP verification schema
  setPasswordAfterOTP: Joi.object({
    email: commonValidations.email,
    password: commonValidations.password,
    // confirmPassword: Joi.string()
    //   .valid(Joi.ref('password'))
    //   .required()
    //   .messages({
    //     'any.only': 'Passwords do not match',
    //     'any.required': 'Confirm password is required'
    //   }),
    username: Joi.string().optional()
  }).when(Joi.object({ role: Joi.string().valid('student') }).unknown(), {
    then: Joi.object({
      username: commonValidations.username.required()
    }),
    otherwise: Joi.object({
      username: Joi.string().optional()
    })
  }),

  // Auth schemas
  setPassword: Joi.object({
    email: commonValidations.email,
    username: commonValidations.username.optional(),
    password: commonValidations.password
  }),

  // In user.validation.js, update the forgotPassword schema:

  forgotPassword: Joi.object({
    email: Joi.string().email().optional(),
    username: Joi.string().optional()
  })
    .custom((value, helpers) => {
      const { email, username } = value;

      // For students, if email is provided, username must also be provided
      // This is because students can share emails (siblings)
      if (email && !username) {
        return helpers.error('any.custom', {
          message: 'Username is required for students when using email'
        });
      }

      return value;
    })
    .or('email', 'username')
    .messages({
      'object.missing': 'Please provide either email or username',
      'any.custom': 'Username is required for students when using email'
    }),

  // Also add a similar check for verifyForgotPasswordOTP
  verifyForgotPasswordOTP: Joi.object({
    email: Joi.string().email().optional(),
    otp: Joi.string()
      .pattern(/^\d{6}$/)
      .required()
      .messages({
        'string.pattern.base': 'OTP must be a 6-digit number'
      }),
    username: Joi.string().optional()
  })
    .custom((value, helpers) => {
      const { email, username } = value;

      if (email && !username) {
        return helpers.error('any.custom', {
          message: 'Username is required for students when using email'
        });
      }

      return value;
    })
    .or('email', 'username')
    .messages({
      'object.missing': 'Please provide either email or username',
      'any.custom': 'Username is required for students when using email'
    }),

  // And for resetPasswordWithOTP
  resetPasswordWithOTP: Joi.object({
    email: Joi.string().email().optional(),
    otp: Joi.string()
      .pattern(/^\d{6}$/)
      .required()
      .messages({
        'string.pattern.base': 'OTP must be a 6-digit number'
      }),
    newPassword: commonValidations.password,
    username: Joi.string().optional()
  })
    .custom((value, helpers) => {
      const { email, username } = value;

      // For students, if email is provided, username must also be provided
      if (email && !username) {
        return helpers.error('any.custom', {
          message: 'Username is required for students when using email'
        });
      }

      return value;
    })
    .or('email', 'username')
    .messages({
      'object.missing': 'Please provide either email or username',
      'any.custom': 'Username is required for students when using email'
    }),

  resetPassword: Joi.object({
      email: Joi.string().email().optional(),
      oldPassword: Joi.string().required(),
      newPassword: commonValidations.password,
      username: Joi.string().optional()
    }).or('email', 'username')
    .messages({
      'object.missing': 'Please provide either email or username'
    }),

  changePassword: Joi.object({
    oldPassword: Joi.string().required(),
    newPassword: commonValidations.password,
  }),

  resendForgotPasswordOTP: Joi.object({
    email: Joi.string().email().optional(),
    username: Joi.string().optional()
  }).or('email', 'username')
    .messages({
      'object.missing': 'Please provide either email or username'
    }),

  loginStaff: Joi.object({
    email: commonValidations.email.required(),
    password: commonValidations.password
  }).messages({
    'any.required': 'Email is required for staff login'
  }),
  loginStudent: Joi.object({
    email: commonValidations.email.required(),
    username: commonValidations.username.required(),
    password: commonValidations.password
  }).messages({
    'any.required': 'Both email and username are required for student login'
  }),

  login: Joi.object({
    email: commonValidations.email,
    username: Joi.string().optional(),
    password: commonValidations.password
  }).xor('email', 'username')
    .messages({
      'object.xor': 'Please provide either email or username',
      'object.missing': 'Please provide either email or username'
    }),

  // Params validation
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
  })
};

module.exports = {
  validationSchemas,
  commonValidations
};