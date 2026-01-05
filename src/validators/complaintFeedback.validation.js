const Joi = require('joi');

const createEntrySchema = Joi.object({
    studentId: Joi.string().pattern(/^[0-9a-fA-F]{24}$/).required().messages({
        'string.pattern.base': 'Invalid student ID format',
        'any.required': 'Student ID is required'
    }),
    classId: Joi.string().pattern(/^[0-9a-fA-F]{24}$/).required().messages({
        'string.pattern.base': 'Invalid class ID format',
        'any.required': 'Class ID is required'
    }),
    sectionId: Joi.string().pattern(/^[0-9a-fA-F]{24}$/).required().messages({
        'string.pattern.base': 'Invalid section ID format',
        'any.required': 'Section ID is required'
    }),
    type: Joi.string().valid('complaint', 'feedback').required().messages({
        'any.only': 'Type must be either "complaint" or "feedback"',
        'any.required': 'Type is required'
    }),
    title: Joi.string().min(3).max(200).required().messages({
        'string.min': 'Title must be at least 3 characters long',
        'string.max': 'Title cannot exceed 200 characters',
        'any.required': 'Title is required'
    }),
    detail: Joi.string().min(10).max(2000).required().messages({
        'string.min': 'Detail must be at least 10 characters long',
        'string.max': 'Detail cannot exceed 2000 characters',
        'any.required': 'Detail is required'
    })
});

const updateEntrySchema = Joi.object({
    title: Joi.string().min(3).max(200).messages({
        'string.min': 'Title must be at least 3 characters long',
        'string.max': 'Title cannot exceed 200 characters'
    }),
    detail: Joi.string().min(10).max(2000).messages({
        'string.min': 'Detail must be at least 10 characters long',
        'string.max': 'Detail cannot exceed 2000 characters'
    })
}).min(1).messages({
    'object.min': 'At least one field (title or detail) must be provided'
});

const reviewComplaintSchema = Joi.object({
    comment: Joi.string().required().messages({
        'any.required': 'Comment is required for review'
    }),
    action: Joi.string().allow('', null)
});

// Enhanced getEntriesSchema for admin with date range filtering
const getEntriesSchema = Joi.object({
    studentId: Joi.string().pattern(/^[0-9a-fA-F]{24}$/).messages({
        'string.pattern.base': 'Invalid student ID format'
    }),
    classId: Joi.string().pattern(/^[0-9a-fA-F]{24}$/).messages({
        'string.pattern.base': 'Invalid class ID format'
    }),
    sectionId: Joi.string().pattern(/^[0-9a-fA-F]{24}$/).messages({
        'string.pattern.base': 'Invalid section ID format'
    }),
    type: Joi.string().valid('complaint', 'feedback').messages({
        'any.only': 'Type must be either "complaint" or "feedback"'
    }),
    status: Joi.string().valid('pending', 'reviewed', 'resolved', 'submitted', 'addressed').messages({
        'any.only': 'Invalid status value'
    }),
    search: Joi.string().max(100).messages({
        'string.max': 'Search query cannot exceed 100 characters'
    }),
    startDate: Joi.date().iso().messages({
        'date.format': 'Start date must be in ISO format (YYYY-MM-DD)'
    }),
    endDate: Joi.date().iso().greater(Joi.ref('startDate')).messages({
        'date.format': 'End date must be in ISO format (YYYY-MM-DD)',
        'date.greater': 'End date must be after start date'
    }),
    sortBy: Joi.string().valid('createdAt', 'updatedAt', 'title', 'status').default('createdAt').messages({
        'any.only': 'Invalid sort field'
    }),
    sortOrder: Joi.string().valid('asc', 'desc').default('desc').messages({
        'any.only': 'Sort order must be "asc" or "desc"'
    }),
    page: Joi.number().integer().min(1).default(1).messages({
        'number.min': 'Page must be at least 1',
        'number.integer': 'Page must be an integer'
    }),
    limit: Joi.number().integer().min(1).max(100).default(10).messages({
        'number.min': 'Limit must be at least 1',
        'number.max': 'Limit cannot exceed 100',
        'number.integer': 'Limit must be an integer'
    })
});

const validate = (schema) => (req, res, next) => {
    const { error, value } = schema.validate(req.body, { abortEarly: false });
    
    if (error) {
        const errorMessages = error.details.map(detail => detail.message);
        return res.status(400).json({ 
            message: 'Validation error',
            errors: errorMessages 
        });
    }
    
    req.body = value;
    next();
};

const validateQuery = (schema) => (req, res, next) => {
    const { error, value } = schema.validate(req.query, { abortEarly: false });
    
    if (error) {
        const errorMessages = error.details.map(detail => detail.message);
        return res.status(400).json({ 
            message: 'Validation error',
            errors: errorMessages 
        });
    }
    
    req.query = value;
    next();
};

module.exports = {
    createEntrySchema,
    updateEntrySchema,
    reviewComplaintSchema,
    getEntriesSchema,
    validate,
    validateQuery
};