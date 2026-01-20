const Joi = require('joi');

// Common validation schema
const sliderBaseSchema = {
    title: Joi.string()
        .min(3)
        .max(100)
        .required()
        .messages({
            'string.base': 'Title must be a string',
            'string.empty': 'Title is required',
            'string.min': 'Title must be at least 3 characters long',
            'string.max': 'Title cannot exceed 100 characters',
            'any.required': 'Title is required'
        }),

    caption: Joi.string()
        .max(500)
        .allow('', null)
        .messages({
            'string.base': 'Caption must be a string',
            'string.max': 'Caption cannot exceed 500 characters'
        }),

    link: Joi.string()
        .uri()
        .allow('', null)
        .messages({
            'string.uri': 'Link must be a valid URL'
        }),

    order: Joi.number()
        .integer()
        .min(0)
        .default(0)
        .messages({
            'number.base': 'Order must be a number',
            'number.integer': 'Order must be an integer',
            'number.min': 'Order cannot be negative'
        }),

    active: Joi.boolean()
        .default(true)
        .messages({
            'boolean.base': 'Active must be true or false'
        })
};

// Validation schemas
const createSuperadminSliderSchema = Joi.object({
    ...sliderBaseSchema,
    // Superadmin can only create global category
    category: Joi.string()
        .valid('global')
        .default('global')
        .messages({
            'any.only': 'Superadmin can only create global category sliders'
        })
});

const createSchoolSliderSchema = Joi.object({
    ...sliderBaseSchema,
    category: Joi.string()
        .valid('event', 'notice', 'general')
        .required()
        .messages({
            'any.only': 'Category must be one of: event, notice, general',
            'any.required': 'Category is required'
        })
});

const updateSliderSchema = Joi.object({
    title: Joi.string()
        .min(3)
        .max(100)
        .messages({
            'string.base': 'Title must be a string',
            'string.min': 'Title must be at least 3 characters long',
            'string.max': 'Title cannot exceed 100 characters'
        }),

    caption: Joi.string()
        .max(500)
        .allow('', null)
        .messages({
            'string.base': 'Caption must be a string',
            'string.max': 'Caption cannot exceed 500 characters'
        }),

    link: Joi.string()
        .uri()
        .allow('', null)
        .messages({
            'string.uri': 'Link must be a valid URL'
        }),

    order: Joi.number()
        .integer()
        .min(0)
        .messages({
            'number.base': 'Order must be a number',
            'number.integer': 'Order must be an integer',
            'number.min': 'Order cannot be negative'
        }),

    active: Joi.boolean()
        .messages({
            'boolean.base': 'Active must be true or false'
        }),

    category: Joi.string()
        .valid('global', 'event', 'notice', 'general')
        .messages({
            'any.only': 'Category must be one of: global, event, notice, general'
        })
}).min(1).messages({
    'object.min': 'At least one field must be provided for update'
});

const getSlidersQuerySchema = Joi.object({
    category: Joi.string()
        .valid('global', 'event', 'notice', 'general')
        .messages({
            'any.only': 'Category must be one of: global, event, notice, general'
        }),

    active: Joi.boolean()
        .messages({
            'boolean.base': 'Active must be true or false'
        }),

    page: Joi.number()
        .integer()
        .min(1)
        .default(1)
        .messages({
            'number.base': 'Page must be a number',
            'number.min': 'Page must be at least 1'
        }),

    limit: Joi.number()
        .integer()
        .min(1)
        .max(100)
        .default(20)
        .messages({
            'number.base': 'Limit must be a number',
            'number.min': 'Limit must be at least 1',
            'number.max': 'Limit cannot exceed 100'
        })
});

const idParamSchema = Joi.object({
    id: Joi.string()
        .pattern(/^[0-9a-fA-F]{24}$/)
        .required()
        .messages({
            'string.pattern.base': 'Invalid ID format',
            'any.required': 'ID is required'
        })
});

// Validation middleware
const validateBody = (schema) => (req, res, next) => {
    const { error, value } = schema.validate(req.body, { 
        abortEarly: false,
        stripUnknown: true 
    });
    
    if (error) {
        const errorMessages = error.details.map(detail => detail.message);
        return res.status(400).json({ 
            success: false,
            message: 'Validation error',
            errors: errorMessages 
        });
    }
    
    req.body = value;
    next();
};

const validateQuery = (schema) => (req, res, next) => {
    const { error, value } = schema.validate(req.query, { 
        abortEarly: false,
        stripUnknown: true 
    });
    
    if (error) {
        const errorMessages = error.details.map(detail => detail.message);
        return res.status(400).json({ 
            success: false,
            message: 'Validation error',
            errors: errorMessages 
        });
    }
    
    req.query = value;
    next();
};

const validateParams = (schema) => (req, res, next) => {
    const { error, value } = schema.validate(req.params, { 
        abortEarly: false,
        stripUnknown: true 
    });
    
    if (error) {
        const errorMessages = error.details.map(detail => detail.message);
        return res.status(400).json({ 
            success: false,
            message: 'Validation error',
            errors: errorMessages 
        });
    }
    
    req.params = value;
    next();
};

module.exports = {
    createSuperadminSliderSchema,
    createSchoolSliderSchema,
    updateSliderSchema,
    getSlidersQuerySchema,
    idParamSchema,
    validateBody,
    validateQuery,
    validateParams
};