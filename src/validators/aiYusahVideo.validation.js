const Joi = require('joi');

const PLATFORMS = {
  YOUTUBE: 'youtube',
  INSTAGRAM: 'instagram',
  TIKTOK: 'tiktok',
  FACEBOOK: 'facebook',
  TWITTER: 'twitter',
  LINKEDIN: 'linkedin'
};

// URL validation for different platforms
const urlValidators = {
  youtube: (url) => {
    const youtubeRegex = /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.?be)\/.+$/;
    return youtubeRegex.test(url);
  },
  instagram: (url) => {
    const instagramRegex = /^(https?:\/\/)?(www\.)?instagram\.com\/(p|reel|tv)\/.+$/;
    return instagramRegex.test(url);
  },
  tiktok: (url) => {
    const tiktokRegex = /^(https?:\/\/)?(www\.)?tiktok\.com\/@[\w.-]+\/video\/\d+$/;
    return tiktokRegex.test(url);
  },
  facebook: (url) => {
    const facebookRegex = /^(https?:\/\/)?(www\.)?facebook\.com\/(watch\?v=\d+|reel\/\d+|\w+\/videos\/\d+)$/;
    return facebookRegex.test(url);
  },
  twitter: (url) => {
    const twitterRegex = /^(https?:\/\/)?(www\.)?twitter\.com\/\w+\/status\/\d+$/;
    return twitterRegex.test(url);
  },
  linkedin: (url) => {
    const linkedinRegex = /^(https?:\/\/)?(www\.)?linkedin\.com\/feed\/update\/urn:li:activity:\d+$/;
    return linkedinRegex.test(url);
  }
};

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

  mediaUrl: Joi.string()
    .required()
    .messages({
      'string.empty': 'Media URL is required',
    }),

  platform: Joi.string()
    .valid(...Object.values(PLATFORMS))
    .required()
    .messages({
      'any.only': `Platform must be one of: ${Object.values(PLATFORMS).join(', ')}`,
      'string.empty': 'Platform is required'
    }),

  category: Joi.string()
    .valid(
      "Animal",
      "Fun",
      "Cartoons",
      "Yushay Stars",
      "AI Poems",
      "English learning",
      "Islamic Studies",
      "Health and Food"
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

// Custom validation to ensure URL matches platform
const validateMediaUrl = (req, res, next) => {
  const { mediaUrl, platform } = req.body;

  if (mediaUrl && platform) {
    const validator = urlValidators[platform];
    if (validator && !validator(mediaUrl)) {
      return res.status(400).json({
        message: `Invalid ${platform} URL format. Please provide a valid ${platform} video URL.`,
        platform,
        url: mediaUrl
      });
    }
  }

  next();
};

// Filter validation for queries
const filterSchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(10),
  search: Joi.string().max(100).optional(),
  category: Joi.string()
    .valid(
      "Animal",
      "Fun",
      "Cartoons",
      "Yushay Stars",
      "AI Poems",
      "English learning",
      "Islamic Studies",
      "Health and Food"
    )
    .optional(),
  platform: Joi.string()
    .valid(...Object.values(PLATFORMS))
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
  PLATFORMS,
  validateVideo,
  validateFilter,
  validateMediaUrl
};