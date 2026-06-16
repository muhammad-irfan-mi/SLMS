const Joi = require("joi");

const createFeeComponentSchema = Joi.object({
    name: Joi.string().trim().min(2).max(100).required(),

    code: Joi.string()
        .trim()
        .uppercase()
        .pattern(/^[A-Z_]+$/)
        .required(),

    category: Joi.string()
        .valid(
            "tuition",
            "transport",
            "library",
            "maintenance",
            "examination",
            "fine",
            "hostel",
            "activity",
            "other"
        )
        .default("other"),

    billingType: Joi.string()
        .valid(
            "monthly",
            "one_time",
            "annual",
            "manual"
        )
        .default("monthly"),

    effectiveFrom: Joi.date().optional(),

    isCustomizable: Joi.boolean().default(false),

    defaultAmount: Joi.number().min(0).allow(null),

    isRequired: Joi.boolean().default(true),

    description: Joi.string()
        .max(500)
        .allow("")
        .optional(),
});

const updateFeeComponentSchema = Joi.object({
    name: Joi.string().trim().min(2).max(100),

    category: Joi.string().valid(
        "tuition",
        "transport",
        "library",
        "maintenance",
        "examination",
        "fine",
        "hostel",
        "activity",
        "other"
    ),

    billingType: Joi.string().valid(
        "monthly",
        "one_time",
        "annual",
        "manual"
    ),

    effectiveFrom: Joi.date(),

    defaultAmount: Joi.number().min(0),

    status: Joi.string().valid(
        "active",
        "inactive"
    ),

    isRequired: Joi.boolean(),

    description: Joi.string()
        .max(500)
        .allow(""),
}).min(1);

module.exports = {
    createFeeComponentSchema,
    updateFeeComponentSchema,
};