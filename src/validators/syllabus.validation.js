// const Joi = require("joi");
// const mongoose = require("mongoose");

// const objectId = (value, helpers) => {
//   if (!mongoose.Types.ObjectId.isValid(value)) {
//     return helpers.message("Invalid ObjectId");
//   }
//   return value;
// };

// const createSyllabusSchema = Joi.object({
//   classId: Joi.string().custom(objectId).required(),
//   sectionId: Joi.string().custom(objectId).required(),
//   subjectId: Joi.string().custom(objectId).required(),

//   title: Joi.string().trim().min(3).max(200).required(),
//   description: Joi.string().trim().allow("").max(1000),
//   detail: Joi.string().trim().allow("").max(5000),

//   publishDate: Joi.date().iso().optional(),
//   expireDate: Joi.date()
//     .iso()
//     .greater(Joi.ref("publishDate"))
//     .optional()
//     .messages({
//       "date.greater": "Expire date must be after publish date",
//     }),

//   status: Joi.string().valid("draft", "published", "archived").optional(),
// });

// const updateSyllabusSchema = Joi.object({
//   title: Joi.string().trim().min(3).max(200),
//   description: Joi.string().trim().allow("").max(1000),
//   detail: Joi.string().trim().allow("").max(5000),

//   publishDate: Joi.date().iso(),
//   expireDate: Joi.date().iso(),

//   status: Joi.string().valid("draft", "published", "archived"),
// }).min(1);

// const getSyllabusQuerySchema = Joi.object({
//   classId: Joi.string().custom(objectId),
//   sectionId: Joi.string().custom(objectId),
//   subjectId: Joi.string().custom(objectId),

//   status: Joi.string().valid("draft", "published", "archived"),

//   page: Joi.number().integer().min(1).default(1),
//   limit: Joi.number().integer().min(1).max(100).default(10),
// });

// const getSyllabusBySectionSchema = Joi.object({
//   sectionId: Joi.string().custom(objectId).required(),
// });

// module.exports = {
//   createSyllabusSchema,
//   updateSyllabusSchema,
//   getSyllabusQuerySchema,
//   getSyllabusBySectionSchema,
// };

















const Joi = require('joi');
const mongoose = require('mongoose');

// Param validations
const syllabusIdParamSchema = Joi.object({
  syllabusId: Joi.string().custom((value, helpers) => {
    if (!mongoose.Types.ObjectId.isValid(value)) {
      return helpers.error('any.invalid');
    }
    return value;
  }).required()
}).unknown(true);

const sectionIdParamSchema = Joi.object({
  sectionId: Joi.string().custom((value, helpers) => {
    if (!mongoose.Types.ObjectId.isValid(value)) {
      return helpers.error('any.invalid');
    }
    return value;
  }).required()
}).unknown(true);

// Body validations
const createSyllabusSchema = Joi.object({
  classId: Joi.string()
    .custom((value, helpers) => {
      if (!mongoose.Types.ObjectId.isValid(value)) {
        return helpers.error('any.invalid');
      }
      return value;
    })
    .required()
    .messages({
      'any.required': 'Class ID is required',
      'any.invalid': 'Invalid class ID format'
    }),
  sectionId: Joi.string()
    .custom((value, helpers) => {
      if (!mongoose.Types.ObjectId.isValid(value)) {
        return helpers.error('any.invalid');
      }
      return value;
    })
    .required()
    .messages({
      'any.required': 'Section ID is required',
      'any.invalid': 'Invalid section ID format'
    }),
  subjectId: Joi.string()
    .custom((value, helpers) => {
      if (!mongoose.Types.ObjectId.isValid(value)) {
        return helpers.error('any.invalid');
      }
      return value;
    })
    .required()
    .messages({
      'any.required': 'Subject ID is required',
      'any.invalid': 'Invalid subject ID format'
    }),
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
  detail: Joi.string()
    .required()
    .messages({
      'string.empty': 'Detail is required'
    }),
  publishDate: Joi.date()
    .optional()
    .messages({
      'date.base': 'Invalid publish date format'
    }),
  expireDate: Joi.date()
    .min(Joi.ref('publishDate'))
    .optional()
    .messages({
      'date.base': 'Invalid expire date format',
      'date.min': 'Expire date must be after publish date'
    }),
  status: Joi.string()
    .valid('draft', 'published', 'archived')
    .default('draft')
    .messages({
      'any.only': 'Status must be one of: draft, published, archived'
    })
});

const updateSyllabusSchema = Joi.object({
  classId: Joi.string()
    .custom((value, helpers) => {
      if (!mongoose.Types.ObjectId.isValid(value)) {
        return helpers.error('any.invalid');
      }
      return value;
    })
    .messages({
      'any.invalid': 'Invalid class ID format'
    }),
  sectionId: Joi.string()
    .custom((value, helpers) => {
      if (!mongoose.Types.ObjectId.isValid(value)) {
        return helpers.error('any.invalid');
      }
      return value;
    })
    .messages({
      'any.invalid': 'Invalid section ID format'
    }),
  subjectId: Joi.string()
    .custom((value, helpers) => {
      if (!mongoose.Types.ObjectId.isValid(value)) {
        return helpers.error('any.invalid');
      }
      return value;
    })
    .messages({
      'any.invalid': 'Invalid subject ID format'
    }),
  title: Joi.string()
    .min(3)
    .max(200)
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
  detail: Joi.string()
    .messages({
      'string.empty': 'Detail is required'
    }),
  publishDate: Joi.date()
    .optional()
    .messages({
      'date.base': 'Invalid publish date format'
    }),
  expireDate: Joi.date()
    .optional()
    .messages({
      'date.base': 'Invalid expire date format'
    }),
  status: Joi.string()
    .valid('draft', 'published', 'archived')
    .messages({
      'any.only': 'Status must be one of: draft, published, archived'
    })
}).min(1);

// Query validations
const getSyllabusQuerySchema = Joi.object({
  classId: Joi.string()
    .custom((value, helpers) => {
      if (!mongoose.Types.ObjectId.isValid(value)) {
        return helpers.error('any.invalid');
      }
      return value;
    })
    .messages({
      'any.invalid': 'Invalid class ID format'
    }),
  sectionId: Joi.string()
    .custom((value, helpers) => {
      if (!mongoose.Types.ObjectId.isValid(value)) {
        return helpers.error('any.invalid');
      }
      return value;
    })
    .messages({
      'any.invalid': 'Invalid section ID format'
    }),
  subjectId: Joi.string()
    .custom((value, helpers) => {
      if (!mongoose.Types.ObjectId.isValid(value)) {
        return helpers.error('any.invalid');
      }
      return value;
    })
    .messages({
      'any.invalid': 'Invalid subject ID format'
    }),
  status: Joi.string()
    .valid('draft', 'published', 'archived')
    .messages({
      'any.only': 'Status must be one of: draft, published, archived'
    }),
  page: Joi.number()
    .integer()
    .min(1)
    .default(1),
  limit: Joi.number()
    .integer()
    .min(1)
    .max(100)
    .default(10)
});

module.exports = {
  syllabusIdParamSchema,
  sectionIdParamSchema,
  createSyllabusSchema,
  updateSyllabusSchema,
  getSyllabusQuerySchema
};