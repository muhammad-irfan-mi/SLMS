const Joi = require("joi");
const mongoose = require("mongoose");

const objectId = (value, helpers) => {
  if (!mongoose.Types.ObjectId.isValid(value)) {
    return helpers.message("Invalid ObjectId");
  }
  return value;
};

const createSyllabusSchema = Joi.object({
  classId: Joi.string().custom(objectId).required(),
  sectionId: Joi.string().custom(objectId).required(),
  subjectId: Joi.string().custom(objectId).required(),

  title: Joi.string().trim().min(3).max(200).required(),
  description: Joi.string().trim().allow("").max(1000),
  detail: Joi.string().trim().allow("").max(5000),

  publishDate: Joi.date().iso().optional(),
  expireDate: Joi.date()
    .iso()
    .greater(Joi.ref("publishDate"))
    .optional()
    .messages({
      "date.greater": "Expire date must be after publish date",
    }),

  status: Joi.string().valid("draft", "published", "archived").optional(),
});

const updateSyllabusSchema = Joi.object({
  title: Joi.string().trim().min(3).max(200),
  description: Joi.string().trim().allow("").max(1000),
  detail: Joi.string().trim().allow("").max(5000),

  publishDate: Joi.date().iso(),
  expireDate: Joi.date().iso(),

  status: Joi.string().valid("draft", "published", "archived"),
}).min(1);

const getSyllabusQuerySchema = Joi.object({
  classId: Joi.string().custom(objectId),
  sectionId: Joi.string().custom(objectId),
  subjectId: Joi.string().custom(objectId),

  status: Joi.string().valid("draft", "published", "archived"),

  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(10),
});

const getSyllabusBySectionSchema = Joi.object({
  sectionId: Joi.string().custom(objectId).required(),
});

module.exports = {
  createSyllabusSchema,
  updateSyllabusSchema,
  getSyllabusQuerySchema,
  getSyllabusBySectionSchema,
};
