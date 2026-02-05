// validators/feeDetail.validation.js
const Joi = require('joi');
const mongoose = require('mongoose');

// Add objectId validation helper
const objectId = Joi.string().custom((value, helpers) => {
  if (!mongoose.Types.ObjectId.isValid(value)) {
    return helpers.message('Invalid ObjectId');
  }
  return value;
}, 'ObjectId validation');

const createFeeDetailSchema = Joi.object({
  studentId: objectId.required()
    .messages({
      'any.required': 'Student ID is required',
      'string.base': 'Student ID must be a string'
    }),
  month: Joi.string().pattern(/^\d{4}-\d{2}$/).required()
    .messages({
      'string.pattern.base': 'Month must be in YYYY-MM format',
      'any.required': 'Month is required'
    }),
  amount: Joi.number().positive().required()
    .messages({
      'number.base': 'Amount must be a number',
      'number.positive': 'Amount must be positive',
      'any.required': 'Amount is required'
    }),
  title: Joi.string().min(1).max(200).required()
    .messages({
      'string.min': 'Title must be at least 1 character',
      'string.max': 'Title cannot exceed 200 characters',
      'any.required': 'Title is required'
    }),
  description: Joi.string().max(500).optional().allow('')
    .messages({
      'string.max': 'Description cannot exceed 500 characters'
    })
});

const updateFeeDetailSchema = Joi.object({
  month: Joi.string().pattern(/^\d{4}-\d{2}$/)
    .messages({
      'string.pattern.base': 'Month must be in YYYY-MM format'
    }),
  amount: Joi.number().positive()
    .messages({
      'number.base': 'Amount must be a number',
      'number.positive': 'Amount must be positive'
    }),
  title: Joi.string().min(1).max(200)
    .messages({
      'string.min': 'Title must be at least 1 character',
      'string.max': 'Title cannot exceed 200 characters'
    }),
  description: Joi.string().max(500).optional().allow('')
    .messages({
      'string.max': 'Description cannot exceed 500 characters'
    })
}).or('month', 'amount', 'title', 'description')
  .messages({
    'object.missing': 'At least one field (month, amount, title, or description) is required'
  });

const approvePaymentSchema = Joi.object({
  status: Joi.string().valid('approved', 'rejected').required()
    .messages({
      'any.only': 'Status must be either approved or rejected',
      'any.required': 'Status is required'
    }),
});

const getAllFeeDetailsSchema = Joi.object({
  page: Joi.number().integer().positive().default(1),
  limit: Joi.number().integer().positive().max(100).default(10),
  studentId: objectId.optional(),
  month: Joi.string().pattern(/^\d{4}-\d{2}$/)
    .messages({
      'string.pattern.base': 'Month must be in YYYY-MM format'
    }),
  status: Joi.string().valid('pending', 'submitted', 'approved', 'rejected'),
});

const getMyFeeDetailsSchema = Joi.object({
  page: Joi.number().integer().positive().default(1),
  limit: Joi.number().integer().positive().max(50).default(10),
});

// Bulk operation schemas
const bulkCreateFeeDetailsSchema = Joi.object({
  feeDetails: Joi.array().items(
    Joi.object({
      studentId: objectId.required()
        .messages({
          'any.required': 'Student ID is required',
          'string.base': 'Student ID must be a string'
        }),
      month: Joi.string().pattern(/^\d{4}-\d{2}$/).required()
        .messages({
          'string.pattern.base': 'Month must be in YYYY-MM format',
          'any.required': 'Month is required'
        }),
      amount: Joi.number().positive().required()
        .messages({
          'number.base': 'Amount must be a number',
          'number.positive': 'Amount must be positive',
          'any.required': 'Amount is required'
        }),
      title: Joi.string().min(1).max(200).required()
        .messages({
          'string.min': 'Title must be at least 1 character',
          'string.max': 'Title cannot exceed 200 characters',
          'any.required': 'Title is required'
        }),
      description: Joi.string().max(500).optional().allow('')
        .messages({
          'string.max': 'Description cannot exceed 500 characters'
        })
    })
  ).min(1).max(100).required()
    .messages({
      'array.min': 'At least one fee detail is required',
      'array.max': 'Cannot create more than 100 fee details at once',
      'array.base': 'Fee details must be an array',
      'any.required': 'Fee details are required'
    })
});

const bulkUpdateFeeDetailsSchema = Joi.object({
  feeUpdates: Joi.array().items(
    Joi.object({
      feeId: objectId.required()
        .messages({
          'any.required': 'Fee ID is required',
          'string.base': 'Fee ID must be a string'
        }),
      month: Joi.string().pattern(/^\d{4}-\d{2}$/)
        .messages({
          'string.pattern.base': 'Month must be in YYYY-MM format'
        }),
      amount: Joi.number().positive()
        .messages({
          'number.base': 'Amount must be a number',
          'number.positive': 'Amount must be positive'
        }),
      title: Joi.string().min(1).max(200)
        .messages({
          'string.min': 'Title must be at least 1 character',
          'string.max': 'Title cannot exceed 200 characters'
        }),
      description: Joi.string().max(500).optional().allow('')
        .messages({
          'string.max': 'Description cannot exceed 500 characters'
        })
    }).or('month', 'amount', 'title', 'description')
      .messages({
        'object.missing': 'At least one field (month, amount, title, or description) is required to update'
      })
  ).min(1).max(100).required()
    .messages({
      'array.min': 'At least one fee update is required',
      'array.max': 'Cannot update more than 100 fee details at once',
      'array.base': 'Fee updates must be an array',
      'any.required': 'Fee updates are required'
    })
});

module.exports = {
  createFeeDetailSchema,
  updateFeeDetailSchema,
  approvePaymentSchema,
  getAllFeeDetailsSchema,
  getMyFeeDetailsSchema,
  bulkCreateFeeDetailsSchema,
  bulkUpdateFeeDetailsSchema
};