const Joi = require('joi');

// Video creation/update validation
const videoSchema = Joi.object({
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

  youtubeLink: Joi.string()
    .required()
    .custom((value, helpers) => {
      // Validate YouTube URL
      const youtubeRegex = /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.?be)\/.+$/;
      if (!youtubeRegex.test(value)) {
        return helpers.message('Invalid YouTube URL. Must be a valid YouTube link');
      }
      return value;
    })
    .messages({
      'string.empty': 'YouTube link is required',
    }),

  category: Joi.string()
    .valid(
      "Behavioural Activities",
      "English Learning",
      "Health & Food",
      "Islamic Studies",
      "Capacity Building",
      "Sports",
      "Education",
      "AI Poems"
    )
    .required()
    .messages({
      'any.only': 'Category must be one of the valid categories',
      'string.empty': 'Category is required'
    }),
    
  status: Joi.string()
    .valid('active', 'inactive')
    .optional()
});

// Filter validation for queries
const filterSchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(10),
  search: Joi.string().max(100).optional(),
  category: Joi.string()
    .valid(
      "Behavioural Activities",
      "English Learning",
      "Health & Food",
      "Islamic Studies",
      "Capacity Building",
      "Sports",
      "Education",
      "AI Poems",
      null
    )
    .optional(),
  status: Joi.string().valid('active', 'inactive').optional()
});

const validateVideo = (req, res, next) => {
  const { error } = videoSchema.validate(req.body, { abortEarly: false });
  
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
  validateVideo,
  validateFilter
};