const Joi = require('joi');
const { commonValidations } = require('./common.validation');

const staffValidation = {
  add: Joi.object({
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
    classId: commonValidations.classIdOptional,
    sectionId: commonValidations.sectionIdOptional
  }),

  update: Joi.object({
    name: commonValidations.nameOptional,
    email: commonValidations.emailOptional,
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
    classId: commonValidations.classIdOptional,
    sectionId: commonValidations.sectionIdOptional,
    password: commonValidations.password.optional()
  }),

  auth: {
    sendOTP: Joi.object({
      email: commonValidations.email
    }),

    verifyOTP: Joi.object({
      email: commonValidations.email,
      otp: commonValidations.otp
    }),

    resendOTP: Joi.object({
      email: commonValidations.email
    }),

    setPasswordAfterOTP: Joi.object({
      email: commonValidations.email,
      password: commonValidations.password
    }),

    login: Joi.object({
      email: commonValidations.email,
      password: commonValidations.password
    }),

    forgotPassword: Joi.object({
      email: commonValidations.email
    }),

    verifyForgotPasswordOTP: Joi.object({
      email: commonValidations.email,
      otp: commonValidations.otp
    }),

    resetPasswordWithOTP: Joi.object({
      email: commonValidations.email,
      otp: commonValidations.otp,
      newPassword: commonValidations.password
    }),

    resetPassword: Joi.object({
      email: commonValidations.email,
      oldPassword: Joi.string().required(),
      newPassword: commonValidations.password
    }),

    resendForgotPasswordOTP: Joi.object({
      email: commonValidations.email
    })
  },

  profile: {
    update: Joi.object({
      name: commonValidations.nameOptional,
      phone: commonValidations.phone,
      address: commonValidations.address,
      salary: Joi.number().positive().optional(),
      joiningDate: Joi.date().iso().max('now').optional()
    }).unknown(false)
  },

  idParam: commonValidations.idParam
};

module.exports = staffValidation;