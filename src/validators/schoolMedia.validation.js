const Joi = require('joi');

// Media creation validation
const createMediaSchema = Joi.object({
  title: Joi.string()
    .min(3)
    .max(200)
    .required()
    .messages({
      'string.empty': 'Title is required',
      'string.min': 'Title must be at least 3 characters',
      'string.max': 'Title cannot exceed 200 characters'
    }),

  description: Joi.string()
    .max(1000)
    .allow('')
    .optional()
    .messages({
      'string.max': 'Description cannot exceed 1000 characters'
    }),

  type: Joi.string()
    .valid('video', 'reel')
    .default('video')
    .messages({
      'any.only': 'Type must be either video or reel'
    }),

  visibility: Joi.string()
    .valid('public', 'school-only')
    .default('school-only')
    .messages({
      'any.only': 'Visibility must be either public or school-only'
    }),

  tags: Joi.alternatives()
    .try(
      Joi.string(),
      Joi.array().items(Joi.string().max(50))
    )
    .optional(),

  eventDate: Joi.date()
    .iso()
    .max('now')
    .optional()
    .messages({
      'date.format': 'Event date must be a valid date (YYYY-MM-DD)',
      'date.max': 'Event date cannot be in the future'
    })
});

// Media update validation
const updateMediaSchema = Joi.object({
  title: Joi.string()
    .min(3)
    .max(200)
    .optional()
    .messages({
      'string.min': 'Title must be at least 3 characters',
      'string.max': 'Title cannot exceed 200 characters'
    }),

  description: Joi.string()
    .max(1000)
    .allow('')
    .optional()
    .messages({
      'string.max': 'Description cannot exceed 1000 characters'
    }),

  type: Joi.string()
    .valid('video', 'reel')
    .optional()
    .messages({
      'any.only': 'Type must be either video or reel'
    }),

  visibility: Joi.string()
    .valid('public', 'school-only')
    .optional()
    .messages({
      'any.only': 'Visibility must be either public or school-only'
    }),

  tags: Joi.alternatives()
    .try(
      Joi.string(),
      Joi.array().items(Joi.string().max(50))
    )
    .optional(),

  eventDate: Joi.date()
    .iso()
    .max('now')
    .optional()
    .messages({
      'date.format': 'Event date must be a valid date (YYYY-MM-DD)',
      'date.max': 'Event date cannot be in the future'
    })
});

// Filter validation for queries
const filterSchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  type: Joi.string().valid('video', 'reel').optional(),
  q: Joi.string().max(100).optional(),
  createdBy: Joi.string().hex().length(24).optional(),
  school: Joi.string().hex().length(24).optional()
});

// File validation middleware
const validateFile = (req, res, next) => {
  if (req.file) {
    // Validate file type (video files)
    const allowedMimeTypes = [
      'video/mp4',
      'video/quicktime',
      'video/x-msvideo',
      'video/x-ms-wmv',
      'video/webm',
      'video/ogg'
    ];
    
    if (!allowedMimeTypes.includes(req.file.mimetype)) {
      return res.status(400).json({
        message: 'Invalid file type. Only video files are allowed',
        allowedTypes: allowedMimeTypes
      });
    }

    // Validate file size (max 500MB)
    const maxSize = 500 * 1024 * 1024; // 500MB
    if (req.file.size > maxSize) {
      return res.status(400).json({
        message: 'File too large. Maximum size is 500MB'
      });
    }
  }
  next();
};

const validateCreateMedia = (req, res, next) => {
  const { error } = createMediaSchema.validate(req.body, { abortEarly: false });
  
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

const validateUpdateMedia = (req, res, next) => {
  const { error } = updateMediaSchema.validate(req.body, { abortEarly: false });
  
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

module.exports = {
  validateCreateMedia,
  validateUpdateMedia,
  validateFilter,
  validateFile
};