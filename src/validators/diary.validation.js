const Joi = require('joi');

const dateValidation = (value, helpers) => {
    const { dueDate } = helpers.state.ancestors[0];
    
    if (dueDate && value) {
        const dateObj = new Date(value);
        const dueDateObj = new Date(dueDate);
        
        if (dueDateObj <= dateObj) {
            return helpers.error('any.invalid');
        }
    }
    return value;
};

const createDiarySchema = Joi.object({
    classId: Joi.string().regex(/^[0-9a-fA-F]{24}$/).required()
        .messages({
            'string.pattern.base': 'Invalid classId format',
            'any.required': 'Class ID is required'
        }),
    sectionId: Joi.string().regex(/^[0-9a-fA-F]{24}$/).required()
        .messages({
            'string.pattern.base': 'Invalid sectionId format',
            'any.required': 'Section ID is required'
        }),
    subjectId: Joi.string().regex(/^[0-9a-fA-F]{24}$/).required()
        .messages({
            'string.pattern.base': 'Invalid subjectId format',
            'any.required': 'Subject ID is required'
        }),
    title: Joi.string().trim().min(1).max(200).required()
        .messages({
            'string.empty': 'Title cannot be empty',
            'string.max': 'Title cannot exceed 200 characters',
            'any.required': 'Title is required'
        }),
    description: Joi.string().trim().allow('').max(1000)
        .messages({
            'string.max': 'Description cannot exceed 1000 characters'
        }),
    date: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).required()
        .custom(dateValidation, 'Date validation')
        .messages({
            'string.pattern.base': 'Date must be in YYYY-MM-DD format',
            'any.required': 'Date is required',
            'any.invalid': 'Due date must be after the diary date'
        }),
    dueDate: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).required()
        .messages({
            'string.pattern.base': 'Due date must be in YYYY-MM-DD format',
            'any.required': 'Due date is required'
        }),
    forAll: Joi.boolean().default(true),
    studentIds: Joi.when('forAll', {
        is: false,
        then: Joi.array().items(Joi.string().trim()).min(1).required()
            .messages({
                'array.min': 'At least one student ID is required when forAll is false',
                'any.required': 'Student IDs are required when forAll is false'
            }),
        otherwise: Joi.array().items(Joi.string().trim()).optional()
    })
});

const updateDiarySchema = Joi.object({
    classId: Joi.string().regex(/^[0-9a-fA-F]{24}$/).optional(),
    sectionId: Joi.string().regex(/^[0-9a-fA-F]{24}$/).optional(),
    subjectId: Joi.string().regex(/^[0-9a-fA-F]{24}$/).optional(),
    title: Joi.string().trim().min(1).max(200).optional(),
    description: Joi.string().trim().allow('').max(1000).optional(),
    date: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).optional()
        .custom(dateValidation, 'Date validation')
        .messages({
            'string.pattern.base': 'Date must be in YYYY-MM-DD format',
            'any.invalid': 'Due date must be after the diary date'
        }),
    dueDate: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).optional()
        .messages({
            'string.pattern.base': 'Due date must be in YYYY-MM-DD format'
        }),
    forAll: Joi.boolean().optional(),
    studentIds: Joi.when('forAll', {
        is: false,
        then: Joi.array().items(Joi.string().trim()).min(1).required()
            .messages({
                'array.min': 'At least one student ID is required when forAll is false'
            }),
        otherwise: Joi.array().items(Joi.string().trim()).optional()
    })
});

const getDiaryQuerySchema = Joi.object({
    date: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).optional(),
    startDate: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).optional(),
    endDate: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).optional(),
    active: Joi.string().valid('true', 'false').optional(),
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(10),
    subjectId: Joi.string().regex(/^[0-9a-fA-F]{24}$/).optional(),
    classId: Joi.string().regex(/^[0-9a-fA-F]{24}$/).optional()
});

module.exports = {
    createDiarySchema,
    updateDiarySchema,
    getDiaryQuerySchema
};