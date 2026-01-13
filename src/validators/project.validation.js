const Joi = require('joi');

// Project creation/update validation
const projectSchema = Joi.object({
  title: Joi.string().min(3).max(200).required()
    .messages({
      'string.empty': 'Title is required',
      'string.min': 'Title must be at least 3 characters',
      'string.max': 'Title cannot exceed 200 characters'
    }),

  description: Joi.string().max(500).allow('').optional(),

  detail: Joi.string().max(2000).allow('').optional(),

  classId: Joi.string().hex().length(24).required()
    .messages({
      'string.hex': 'Class ID must be a valid MongoDB ObjectId',
      'string.length': 'Class ID must be 24 characters'
    }),

  sectionId: Joi.string().hex().length(24).required()
    .messages({
      'string.hex': 'Section ID must be a valid MongoDB ObjectId',
      'string.length': 'Section ID must be 24 characters'
    }),

  subjectId: Joi.string().hex().length(24).required()
    .messages({
      'string.hex': 'Subject ID must be a valid MongoDB ObjectId',
      'string.length': 'Subject ID must be 24 characters'
    }),

  targetType: Joi.string().valid('section', 'students').default('section'),

  studentIds: Joi.when('targetType', {
    is: 'students',
    then: Joi.alternatives().try(
      Joi.array().items(Joi.string().hex().length(24)).min(1).required(),
      Joi.string().custom((value, helpers) => {
        try {
          const parsed = JSON.parse(value);
          if (!Array.isArray(parsed)) {
            return helpers.error('any.invalid');
          }
          const isValid = parsed.every(id => /^[0-9a-fA-F]{24}$/.test(id));
          if (!isValid) {
            return helpers.error('any.invalid');
          }
          return parsed;
        } catch {
          return helpers.error('any.invalid');
        }
      }, 'JSON Array Validation')
    ).required().messages({
      'alternatives.types': 'studentIds must be an array or a valid JSON array string',
      'array.base': 'studentIds must be an array',
      'array.min': 'At least one student must be selected'
    }),
    otherwise: Joi.array().items(Joi.string().hex().length(24)).optional()
  }),

  deadline: Joi.date().iso().greater('now').required()
    .messages({
      'date.format': 'Deadline must be a valid ISO date (YYYY-MM-DD)',
      'date.greater': 'Deadline must be a future date'
    }),

  maxMarks: Joi.number().min(0).max(1000).optional()
    .messages({
      'number.min': 'Maximum marks cannot be negative',
      'number.max': 'Maximum marks cannot exceed 1000'
    }),

  // status: Joi.string().valid('draft', 'assigned', 'completed', 'graded').default('assigned'),

  // File validation (for file size, type, etc.)
  fileValidation: Joi.object({
    images: Joi.array().max(2).optional()
      .messages({
        'array.max': 'Maximum 2 images allowed'
      }),
    pdf: Joi.array().max(1).optional()
  }).optional()
});

// Filter validation for queries
const filterSchema = Joi.object({
  classId: Joi.string().hex().length(24).optional(),
  sectionId: Joi.string().hex().length(24).optional(),
  subjectId: Joi.string().hex().length(24).optional(),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(10),
  status: Joi.string().valid('draft', 'assigned', 'completed', 'graded').optional(),
  targetType: Joi.string().valid('section', 'students').optional(),
  fromDate: Joi.date().iso().optional(),
  toDate: Joi.date().iso().optional(),
  withSubmissions: Joi.boolean().optional(),
  graded: Joi.string().valid('true', 'false').optional(),
  studentId: Joi.string().hex().length(24).optional()
});

// Submission validation
const submissionSchema = Joi.object({
  projectId: Joi.string().hex().length(24).required(),
  submissionText: Joi.string().max(5000).allow('').optional()
});

// Grading validation
const gradingSchema = Joi.object({
  marks: Joi.number().min(0).optional(),
  feedback: Joi.string().max(1000).allow('').optional(),
  grade: Joi.string().valid('A', 'B', 'C', 'D', 'F').optional(),
  status: Joi.string().valid('submitted', 'graded', 'rejected', 'resubmit').optional()
});

// File validation middleware
const validateFiles = (req, res, next) => {
  if (req.files) {
    if (req.files.images && req.files.images.length > 5) {
      return res.status(400).json({
        message: 'Maximum 5 images allowed'
      });
    }

    if (req.files.pdf && req.files.pdf.length > 1) {
      return res.status(400).json({
        message: 'Only one PDF file allowed'
      });
    }

    // Validate file types
    if (req.files.images) {
      for (const image of req.files.images) {
        if (!image.mimetype.startsWith('image/')) {
          return res.status(400).json({
            message: 'Images must be valid image files'
          });
        }
      }
    }

    if (req.files.pdf && req.files.pdf[0]) {
      const pdf = req.files.pdf[0];
      if (pdf.mimetype !== 'application/pdf') {
        return res.status(400).json({
          message: 'PDF file must be a valid PDF document'
        });
      }
    }
  }
  next();
};

const validateProject = (req, res, next) => {
  const { error } = projectSchema.validate(req.body, { abortEarly: false });

  if (error) {
    const errors = error.details.map(detail => ({
      field: detail.path.join('.'),
      message: detail.message
    }));

    return res.status(400).json({
      message: 'Validation failed',
      errors
    });
  }

  next();
};

const validateFilter = (req, res, next) => {
  const { error } = filterSchema.validate(req.query, { abortEarly: false });

  if (error) {
    const errors = error.details.map(detail => ({
      field: detail.path.join('.'),
      message: detail.message
    }));

    return res.status(400).json({
      message: 'Filter validation failed',
      errors
    });
  }

  next();
};

const validateSubmission = (req, res, next) => {
  const { error } = submissionSchema.validate(req.body, { abortEarly: false });

  if (error) {
    const errors = error.details.map(detail => ({
      field: detail.path.join('.'),
      message: detail.message
    }));

    return res.status(400).json({
      message: 'Submission validation failed',
      errors
    });
  }

  next();
};

const validateGrading = (req, res, next) => {
  // Get maxMarks from project if needed for validation
  const { error } = gradingSchema.validate(req.body, { abortEarly: false });

  if (error) {
    const errors = error.details.map(detail => ({
      field: detail.path.join('.'),
      message: detail.message
    }));

    return res.status(400).json({
      message: 'Grading validation failed',
      errors
    });
  }

  next();
};

module.exports = {
  validateProject,
  validateFilter,
  validateFiles,
  validateSubmission,
  validateGrading
};