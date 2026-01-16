const Joi = require('joi');

const validateTimeFormat = (value, helpers) => {
    const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
    if (!timeRegex.test(value)) {
        return helpers.error('any.invalid');
    }
    return value;
};

const convertToMinutes = (time) => {
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
};

const getPakistanDate = () => {
    const now = new Date();
    const offset = 5 * 60 * 60 * 1000;
    return new Date(now.getTime() + offset);
};

const validateTimeRange = (value, helpers) => {
    const { startTime } = helpers.state.ancestors[0];
    if (!startTime) return value;
    
    const start = convertToMinutes(startTime);
    const end = convertToMinutes(value);
    
    if (end <= start) {
        return helpers.error('any.invalid');
    }
    
    return value;
};

const validateExamDate = (value, helpers) => {
    const examDate = new Date(value);
    const today = getPakistanDate();
    today.setHours(0, 0, 0, 0);
    examDate.setHours(0, 0, 0, 0);
    
    if (examDate < today) {
        return helpers.error('any.invalid');
    }
    
    return value;
};

const createExamScheduleSchema = Joi.object({
    type: Joi.string()
        .valid('midterm', 'midterm2', 'final')
        .required()
        .messages({
            'any.only': 'Type must be one of: midterm, midterm2, final',
            'any.required': 'Type is required'
        }),

    year: Joi.number()
        .integer()
        .min(2020)
        .max(2100)
        .required()
        .messages({
            'number.min': 'Year must be at least 2020',
            'number.max': 'Year cannot exceed 2100',
            'number.integer': 'Year must be an integer',
            'any.required': 'Year is required'
        }),

    schedules: Joi.array()
        .items(
            Joi.object({
                classId: Joi.string()
                    .pattern(/^[0-9a-fA-F]{24}$/)
                    .required()
                    .messages({
                        'string.pattern.base': 'Invalid class ID format',
                        'any.required': 'Class ID is required'
                    }),

                sectionId: Joi.string()
                    .pattern(/^[0-9a-fA-F]{24}$/)
                    .required()
                    .messages({
                        'string.pattern.base': 'Invalid section ID format',
                        'any.required': 'Section ID is required'
                    }),

                subjectId: Joi.string()
                    .pattern(/^[0-9a-fA-F]{24}$/)
                    .required()
                    .messages({
                        'string.pattern.base': 'Invalid subject ID format',
                        'any.required': 'Subject ID is required'
                    }),

                teacherId: Joi.string()
                    .pattern(/^[0-9a-fA-F]{24}$/)
                    .required()
                    .messages({
                        'string.pattern.base': 'Invalid teacher ID format',
                        'any.required': 'Teacher ID is required'
                    }),

                examDate: Joi.date()
                    .required()
                    .custom(validateExamDate, 'Exam date validation')
                    .messages({
                        'date.base': 'Exam date must be a valid date',
                        'any.invalid': 'Exam date cannot be in the past',
                        'any.required': 'Exam date is required'
                    }),

                day: Joi.string()
                    .valid('Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday')
                    .required()
                    .messages({
                        'any.only': 'Day must be a valid weekday',
                        'any.required': 'Day is required'
                    }),

                startTime: Joi.string()
                    .custom(validateTimeFormat, 'Time format validation')
                    .required()
                    .messages({
                        'any.invalid': 'Start time must be in HH:MM format (24-hour)',
                        'any.required': 'Start time is required'
                    }),

                endTime: Joi.string()
                    .custom(validateTimeFormat, 'Time format validation')
                    .custom(validateTimeRange, 'Time range validation')
                    .required()
                    .messages({
                        'any.invalid': 'End time must be in HH:MM format and after start time',
                        'any.required': 'End time is required'
                    })
            })
        )
        .min(1)
        .required()
        .messages({
            'array.min': 'At least one schedule is required',
            'any.required': 'Schedules array is required',
            'array.base': 'Schedules must be an array'
        })
});

const updateExamScheduleSchema = Joi.object({
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

    subjectId: Joi.string()
        .pattern(/^[0-9a-fA-F]{24}$/)
        .messages({
            'string.pattern.base': 'Invalid subject ID format'
        }),

    teacherId: Joi.string()
        .pattern(/^[0-9a-fA-F]{24}$/)
        .messages({
            'string.pattern.base': 'Invalid teacher ID format'
        }),

    examDate: Joi.date()
        .custom(validateExamDate, 'Exam date validation')
        .messages({
            'date.base': 'Exam date must be a valid date',
            'any.invalid': 'Exam date cannot be in the past'
        }),

    day: Joi.string()
        .valid('Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday')
        .messages({
            'any.only': 'Day must be a valid weekday'
        }),

    startTime: Joi.string()
        .custom(validateTimeFormat, 'Time format validation')
        .messages({
            'any.invalid': 'Start time must be in HH:MM format (24-hour)'
        }),

    endTime: Joi.string()
        .custom(validateTimeFormat, 'Time format validation')
        .custom(validateTimeRange, 'Time range validation')
        .messages({
            'any.invalid': 'End time must be in HH:MM format and after start time'
        })
        .when('startTime', {
            is: Joi.exist(),
            then: Joi.required().messages({
                'any.required': 'End time is required when start time is provided'
            }),
            otherwise: Joi.optional()
        }),

    type: Joi.string()
        .valid('midterm', 'midterm2', 'final')
        .messages({
            'any.only': 'Type must be one of: midterm, midterm2, final'
        }),

    year: Joi.number()
        .integer()
        .min(2020)
        .max(2100)
        .messages({
            'number.min': 'Year must be at least 2020',
            'number.max': 'Year cannot exceed 2100',
            'number.integer': 'Year must be an integer'
        }),

    status: Joi.string()
        .valid('scheduled', 'ongoing', 'completed', 'cancelled')
        .messages({
            'any.only': 'Status must be one of: scheduled, ongoing, completed, cancelled'
        }),

    cancellationReason: Joi.string()
        .max(500)
        .messages({
            'string.max': 'Cancellation reason cannot exceed 500 characters'
        })
}).min(1).messages({
    'object.min': 'At least one field must be provided for update'
});

const getScheduleQuerySchema = Joi.object({
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

    subjectId: Joi.string()
        .pattern(/^[0-9a-fA-F]{24}$/)
        .messages({
            'string.pattern.base': 'Invalid subject ID format'
        }),

    teacherId: Joi.string()
        .pattern(/^[0-9a-fA-F]{24}$/)
        .messages({
            'string.pattern.base': 'Invalid teacher ID format'
        }),

    type: Joi.string()
        .valid('midterm', 'midterm2', 'final')
        .messages({
            'any.only': 'Type must be one of: midterm, midterm2, final'
        }),

    year: Joi.number()
        .integer()
        .min(2020)
        .max(2100)
        .messages({
            'number.min': 'Year must be at least 2020',
            'number.max': 'Year cannot exceed 2100',
            'number.integer': 'Year must be an integer'
        }),

    status: Joi.string()
        .valid('scheduled', 'ongoing', 'completed', 'cancelled')
        .messages({
            'any.only': 'Status must be one of: scheduled, ongoing, completed, cancelled'
        }),

    startDate: Joi.date()
        .messages({
            'date.base': 'Start date must be a valid date'
        }),

    endDate: Joi.date()
        .messages({
            'date.base': 'End date must be a valid date'
        })
        .when('startDate', {
            is: Joi.exist(),
            then: Joi.optional(),
            otherwise: Joi.forbidden().messages({
                'any.unknown': 'End date can only be provided when startDate is provided'
            })
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
        .valid('examDate', 'startTime', 'day', 'type', 'createdAt', 'updatedAt')
        .default('examDate')
        .messages({
            'any.only': 'Sort by must be one of: examDate, startTime, day, type, createdAt, updatedAt'
        }),

    sortOrder: Joi.string()
        .valid('asc', 'desc')
        .default('asc')
        .messages({
            'any.only': 'Sort order must be "asc" or "desc"'
        })
});

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

module.exports = {
    createExamScheduleSchema,
    updateExamScheduleSchema,
    getScheduleQuerySchema,
    validateBody,
    validateQuery
};