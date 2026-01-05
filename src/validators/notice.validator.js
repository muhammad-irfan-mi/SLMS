const Joi = require('joi');

// Helper function for date validation (YYYY-MM-DD)
const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

// Custom validation for date comparison - end date should not be less than start date
const validateDateRange = (value, helpers) => {
    if (!value) return value;
    
    const { startDate } = helpers.state.ancestors[0];
    if (!startDate) return value;
    
    const start = new Date(startDate);
    const end = new Date(value);
    
    // Check if end date is less than start date
    if (end < start) {
        return helpers.error('any.invalid');
    }
    
    return value;
};

// Create notice schema
const createNoticeSchema = Joi.object({
    title: Joi.string()
        .min(3)
        .max(200)
        .required()
        .messages({
            'string.min': 'Title must be at least 3 characters long',
            'string.max': 'Title cannot exceed 200 characters',
            'any.required': 'Title is required'
        }),

    message: Joi.string()
        .min(10)
        .max(5000)
        .required()
        .messages({
            'string.min': 'Message must be at least 10 characters long',
            'string.max': 'Message cannot exceed 5000 characters',
            'any.required': 'Message is required'
        }),

    target: Joi.string()
        .valid('all', 'all_teachers', 'selected_teachers', 'all_students', 'selected_students', 'class', 'section', 'custom')
        .default('all')
        .messages({
            'any.only': 'Target must be one of: all, all_teachers, selected_teachers, all_students, selected_students, class, section, custom'
        }),

    targetTeacherIds: Joi.array()
        .items(
            Joi.string()
                .pattern(/^[0-9a-fA-F]{24}$/)
                .message('Invalid teacher ID format')
        )
        .when('target', {
            is: 'selected_teachers',
            then: Joi.array().min(1).required().messages({
                'array.min': 'At least one teacher ID is required for selected_teachers target',
                'any.required': 'targetTeacherIds is required for selected_teachers target'
            }),
            otherwise: Joi.array().optional()
        })
        .messages({
            'array.base': 'targetTeacherIds must be an array'
        }),

    targetStudentIds: Joi.array()
        .items(
            Joi.string()
                .pattern(/^[0-9a-fA-F]{24}$/)
                .message('Invalid student ID format')
        )
        .when('target', {
            is: 'selected_students',
            then: Joi.array().min(1).required().messages({
                'array.min': 'At least one student ID is required for selected_students target',
                'any.required': 'targetStudentIds is required for selected_students target'
            }),
            otherwise: Joi.array().optional()
        })
        .messages({
            'array.base': 'targetStudentIds must be an array'
        }),

    classId: Joi.string()
        .pattern(/^[0-9a-fA-F]{24}$/)
        .messages({
            'string.pattern.base': 'Invalid class ID format'
        })
        .when('target', {
            is: Joi.valid('class', 'section'),
            then: Joi.required().messages({
                'any.required': 'classId is required for class/section target'
            }),
            otherwise: Joi.optional()
        }),

    sectionId: Joi.string()
        .pattern(/^[0-9a-fA-F]{24}$/)
        .messages({
            'string.pattern.base': 'Invalid section ID format'
        })
        .when('target', {
            is: 'section',
            then: Joi.required().messages({
                'any.required': 'sectionId is required for section target'
            }),
            otherwise: Joi.optional()
        }),

    category: Joi.string()
        .valid('notice', 'meeting', 'holiday', 'general')
        .default('notice')
        .messages({
            'any.only': 'Category must be one of: notice, meeting, holiday, general'
        }),

    startDate: Joi.string()
        .pattern(dateRegex)
        .messages({
            'string.pattern.base': 'Start date must be in YYYY-MM-DD format'
        }),

    endDate: Joi.string()
        .pattern(dateRegex)
        .custom(validateDateRange, 'End date validation')
        .messages({
            'string.pattern.base': 'End date must be in YYYY-MM-DD format',
            'any.invalid': 'End date cannot be before start date'
        })
        .when('startDate', {
            is: Joi.exist(),
            then: Joi.optional(),
            otherwise: Joi.forbidden().messages({
                'any.unknown': 'End date can only be provided when startDate is provided'
            })
        }),

    attachments: Joi.array()
        .items(Joi.string().uri().messages({
            'string.uri': 'Attachment must be a valid URL'
        }))
        .max(5)
        .messages({
            'array.max': 'Maximum 5 attachments allowed',
            'array.base': 'Attachments must be an array'
        }),

    pinned: Joi.boolean()
        .default(false)
        .messages({
            'boolean.base': 'Pinned must be a boolean'
        })
});

// Update notice schema
const updateNoticeSchema = Joi.object({
    title: Joi.string()
        .min(3)
        .max(200)
        .messages({
            'string.min': 'Title must be at least 3 characters long',
            'string.max': 'Title cannot exceed 200 characters'
        }),

    message: Joi.string()
        .min(10)
        .max(5000)
        .messages({
            'string.min': 'Message must be at least 10 characters long',
            'string.max': 'Message cannot exceed 5000 characters'
        }),

    target: Joi.string()
        .valid('all', 'all_teachers', 'selected_teachers', 'all_students', 'selected_students', 'class', 'section', 'custom')
        .messages({
            'any.only': 'Target must be one of: all, all_teachers, selected_teachers, all_students, selected_students, class, section, custom'
        }),

    targetTeacherIds: Joi.array()
        .items(
            Joi.string()
                .pattern(/^[0-9a-fA-F]{24}$/)
                .message('Invalid teacher ID format')
        )
        .messages({
            'array.base': 'targetTeacherIds must be an array'
        }),

    targetStudentIds: Joi.array()
        .items(
            Joi.string()
                .pattern(/^[0-9a-fA-F]{24}$/)
                .message('Invalid student ID format')
        )
        .messages({
            'array.base': 'targetStudentIds must be an array'
        }),

    classId: Joi.string()
        .pattern(/^[0-9a-fA-F]{24}$/)
        .messages({
            'string.pattern.base': 'Invalid class ID format'
        }),

    sectionId: Joi.string()
        .pattern(/^[0-9a-fA-F]{24}$/)
        .messages({
            'string.pattern.base': 'Invalid section ID format'
        }),

    category: Joi.string()
        .valid('notice', 'meeting', 'holiday', 'general')
        .messages({
            'any.only': 'Category must be one of: notice, meeting, holiday, general'
        }),

    startDate: Joi.string()
        .pattern(dateRegex)
        .messages({
            'string.pattern.base': 'Start date must be in YYYY-MM-DD format'
        }),

    endDate: Joi.string()
        .pattern(dateRegex)
        .custom(validateDateRange, 'End date validation')
        .messages({
            'string.pattern.base': 'End date must be in YYYY-MM-DD format',
            'any.invalid': 'End date cannot be before start date'
        })
        .when('startDate', {
            is: Joi.exist(),
            then: Joi.optional(),
            otherwise: Joi.forbidden().messages({
                'any.unknown': 'End date can only be provided when startDate is provided'
            })
        }),

    attachments: Joi.array()
        .items(Joi.string().uri().messages({
            'string.uri': 'Attachment must be a valid URL'
        }))
        .max(5)
        .messages({
            'array.max': 'Maximum 5 attachments allowed',
            'array.base': 'Attachments must be an array'
        }),

    pinned: Joi.boolean()
        .messages({
            'boolean.base': 'Pinned must be a boolean'
        })
}).min(1).messages({
    'object.min': 'At least one field must be provided for update'
});

// Get notices query schema (for teachers/admins)
const getNoticesQuerySchema = Joi.object({
    classId: Joi.string()
        .pattern(/^[0-9a-fA-F]{24}$/)
        .messages({
            'string.pattern.base': 'Invalid class ID format'
        }),

    sectionId: Joi.string()
        .pattern(/^[0-9a-fA-F]{24}$/)
        .messages({
            'string.pattern.base': 'Invalid section ID format'
        }),

    category: Joi.string()
        .valid('notice', 'meeting', 'holiday', 'general')
        .messages({
            'any.only': 'Category must be one of: notice, meeting, holiday, general'
        }),

    activeOnly: Joi.string()
        .valid('true', 'false')
        .messages({
            'any.only': 'activeOnly must be either "true" or "false"'
        }),

    target: Joi.string()
        .valid('all', 'all_teachers', 'selected_teachers', 'all_students', 'selected_students', 'class', 'section', 'custom')
        .messages({
            'any.only': 'Target must be one of: all, all_teachers, selected_teachers, all_students, selected_students, class, section, custom'
        }),

    startDate: Joi.string()
        .pattern(dateRegex)
        .messages({
            'string.pattern.base': 'Start date must be in YYYY-MM-DD format'
        }),

    endDate: Joi.string()
        .pattern(dateRegex)
        .messages({
            'string.pattern.base': 'End date must be in YYYY-MM-DD format'
        }),

    search: Joi.string()
        .max(100)
        .messages({
            'string.max': 'Search query cannot exceed 100 characters'
        }),

    page: Joi.number()
        .integer()
        .min(1)
        .default(1)
        .messages({
            'number.min': 'Page must be at least 1',
            'number.integer': 'Page must be an integer'
        }),

    limit: Joi.number()
        .integer()
        .min(1)
        .max(100)
        .default(10)
        .messages({
            'number.min': 'Limit must be at least 1',
            'number.max': 'Limit cannot exceed 100',
            'number.integer': 'Limit must be an integer'
        }),

    sortBy: Joi.string()
        .valid('createdAt', 'updatedAt', 'startDate', 'endDate', 'pinned')
        .default('createdAt')
        .messages({
            'any.only': 'Sort by must be one of: createdAt, updatedAt, startDate, endDate, pinned'
        }),

    sortOrder: Joi.string()
        .valid('asc', 'desc')
        .default('desc')
        .messages({
            'any.only': 'Sort order must be "asc" or "desc"'
        })
});

// Get notices for student query schema
const getNoticesForStudentQuerySchema = Joi.object({
    category: Joi.string()
        .valid('notice', 'meeting', 'holiday', 'general')
        .messages({
            'any.only': 'Category must be one of: notice, meeting, holiday, general'
        }),

    activeOnly: Joi.string()
        .valid('true', 'false')
        .messages({
            'any.only': 'activeOnly must be either "true" or "false"'
        }),

    startDate: Joi.string()
        .pattern(dateRegex)
        .messages({
            'string.pattern.base': 'Start date must be in YYYY-MM-DD format'
        }),

    endDate: Joi.string()
        .pattern(dateRegex)
        .messages({
            'string.pattern.base': 'End date must be in YYYY-MM-DD format'
        }),

    search: Joi.string()
        .max(100)
        .messages({
            'string.max': 'Search query cannot exceed 100 characters'
        }),

    page: Joi.number()
        .integer()
        .min(1)
        .default(1)
        .messages({
            'number.min': 'Page must be at least 1',
            'number.integer': 'Page must be an integer'
        }),

    limit: Joi.number()
        .integer()
        .min(1)
        .max(100)
        .default(10)
        .messages({
            'number.min': 'Limit must be at least 1',
            'number.max': 'Limit cannot exceed 100',
            'number.integer': 'Limit must be an integer'
        })
});

// Validation middleware
const validate = (schema) => (req, res, next) => {
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

module.exports = {
    createNoticeSchema,
    updateNoticeSchema,
    getNoticesQuerySchema,
    getNoticesForStudentQuerySchema,
    validate,
    validateQuery
};