const Joi = require('joi');

// Single question validation
const questionSchema = Joi.object({
    type: Joi.string()
        .valid('mcq', 'fill')
        .required()
        .messages({
            'any.only': 'Question type must be either "mcq" or "fill"',
            'string.empty': 'Question type is required'
        }),

    title: Joi.string()
        .min(3)
        .max(500)
        .required()
        .messages({
            'string.empty': 'Question title is required',
            'string.min': 'Question title must be at least 3 characters',
            'string.max': 'Question title cannot exceed 500 characters'
        }),

    options: Joi.when('type', {
        is: 'mcq',
        then: Joi.array()
            .items(Joi.string().min(1).max(200))
            .min(2)
            .max(10)
            .required()
            .messages({
                'array.min': 'MCQ must have at least 2 options',
                'array.max': 'MCQ cannot have more than 10 options',
                'array.base': 'Options must be an array'
            }),
        otherwise: Joi.array().optional()
    }),

    correctOptionIndex: Joi.when('type', {
        is: 'mcq',
        then: Joi.number()
            .integer()
            .min(0)
            .required()
            .messages({
                'number.base': 'Correct option index must be a number',
                'number.min': 'Correct option index cannot be negative',
                'number.required': 'Correct option index is required for MCQ'
            }),
        otherwise: Joi.number().optional()
    }),

    correctAnswer: Joi.when('type', {
        is: 'fill',
        then: Joi.string()
            .min(1)
            .max(200)
            .required()
            .messages({
                'string.empty': 'Correct answer is required for fill type',
                'string.min': 'Correct answer must be at least 1 character',
                'string.max': 'Correct answer cannot exceed 200 characters'
            }),
        otherwise: Joi.string().optional()
    }),

    marks: Joi.number()
        .min(0.5)
        .max(20)
        .default(1)
        .messages({
            'number.min': 'Marks cannot be less than 0.5',
            'number.max': 'Marks cannot exceed 20'
        }),

    order: Joi.number()
        .integer()
        .min(0)
        .default(0)
        .messages({
            'number.min': 'Order cannot be negative'
        })
});

// Quiz group creation/update validation
const quizGroupSchema = Joi.object({
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

    classIds: Joi.array()
        .items(Joi.string().hex().length(24))
        .optional()
        .messages({
            'array.base': 'classIds must be an array'
        }),

    sectionIds: Joi.array()
        .items(Joi.string().hex().length(24))
        .optional()
        .messages({
            'array.base': 'sectionIds must be an array'
        }),

    questions: Joi.array()
        .items(questionSchema)
        .min(1)
        .max(50)
        .optional()
        .messages({
            'array.min': 'At least one question is required',
            'array.max': 'Cannot have more than 50 questions'
        }),

    startTime: Joi.date()
        .iso()
        .greater('now')
        .optional()
        .messages({
            'date.format': 'Start time must be a valid ISO date',
            'date.greater': 'Start time must be in the future'
        }),

    endTime: Joi.date()
        .iso()
        .greater(Joi.ref('startTime'))
        .optional()
        .messages({
            'date.format': 'End time must be a valid ISO date',
            'date.greater': 'End time must be after start time'
        }),

    status: Joi.string()
        .valid('draft', 'published', 'archived')
        .default('draft')
        .messages({
            'any.only': 'Status must be draft, published, or archived'
        }),

    // For file upload, questions array is optional
    hasFile: Joi.boolean().optional()
});

// Quiz submission validation
const quizSubmissionSchema = Joi.object({
    answers: Joi.array()
        .items(
            Joi.object({
                questionId: Joi.string()
                    .hex()
                    .length(24)
                    .required()
                    .messages({
                        'string.hex': 'Question ID must be a valid MongoDB ObjectId',
                        'string.length': 'Question ID must be 24 characters'
                    }),

                type: Joi.string()
                    .valid('mcq', 'fill')
                    .required()
                    .messages({
                        'any.only': 'Answer type must be either "mcq" or "fill"'
                    }),

                chosenIndex: Joi.when('type', {
                    is: 'mcq',
                    then: Joi.number()
                        .integer()
                        .min(0)
                        .required()
                        .messages({
                            'number.base': 'Chosen index must be a number for MCQ',
                            'number.min': 'Chosen index cannot be negative'
                        }),
                    otherwise: Joi.number().optional()
                }),

                answerText: Joi.when('type', {
                    is: 'fill',
                    then: Joi.string()
                        .min(1)
                        .max(500)
                        .required()
                        .messages({
                            'string.empty': 'Answer text is required for fill type',
                            'string.min': 'Answer text must be at least 1 character',
                            'string.max': 'Answer text cannot exceed 500 characters'
                        }),
                    otherwise: Joi.string().optional()
                })
            })
        )
        .min(1)
        .required()
        .messages({
            'array.min': 'At least one answer is required',
            'array.base': 'Answers must be an array'
        })
});

// Filter validation for queries
const filterSchema = Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(10),
    status: Joi.string().valid('draft', 'published', 'archived').optional(),
    classId: Joi.string().hex().length(24).optional(),
    sectionId: Joi.string().hex().length(24).optional(),
    search: Joi.string().max(100).optional()
});

// Leaderboard filter validation
const leaderboardFilterSchema = Joi.object({
    groupId: Joi.string().hex().length(24).required(),
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(20),
    classId: Joi.string().hex().length(24).optional(),
    sectionId: Joi.string().hex().length(24).optional()
});

// File validation middleware
const validateFile = (req, res, next) => {
    if (req.file) {
        const allowedMimeTypes = [
            'text/csv',
            'application/json',
            'application/vnd.ms-excel',
            'text/plain'
        ];

        if (!allowedMimeTypes.includes(req.file.mimetype)) {
            return res.status(400).json({
                message: 'Invalid file type. Only CSV and JSON files are allowed',
                allowedTypes: ['CSV', 'JSON']
            });
        }

        // Validate file size (max 5MB)
        const maxSize = 5 * 1024 * 1024; // 5MB
        if (req.file.size > maxSize) {
            return res.status(400).json({
                message: 'File too large. Maximum size is 5MB'
            });
        }
    }
    next();
};

const validateQuizGroup = (req, res, next) => {
    const { title, classIds, sectionIds, startTime, endTime } = req.body;

    // Helper function to parse array fields
    const parseArray = (field) => {
        if (!field) return [];
        if (Array.isArray(field)) return field;
        if (typeof field === 'string') {
            try {
                const parsed = JSON.parse(field);
                return Array.isArray(parsed) ? parsed : [parsed];
            } catch {
                // Handle comma-separated values
                return field.split(',').map(item => item.trim()).filter(item => item);
            }
        }
        return [];
    };

    // Parse array fields
    req.body.classIds = parseArray(classIds);
    req.body.sectionIds = parseArray(sectionIds);

    // Validate required fields
    if (!title || title.trim().length < 3) {
        return res.status(400).json({
            message: "Title is required and must be at least 3 characters long"
        });
    }

    // Validate dates if provided
    if (startTime) {
        const startDate = new Date(startTime);
        if (isNaN(startDate.getTime())) {
            return res.status(400).json({
                message: "Invalid startTime format. Use ISO 8601 format."
            });
        }
    }

    if (endTime) {
        const endDate = new Date(endTime);
        if (isNaN(endDate.getTime())) {
            return res.status(400).json({
                message: "Invalid endTime format. Use ISO 8601 format."
            });
        }
    }

    // Validate startTime is before endTime if both provided
    if (startTime && endTime) {
        const startDate = new Date(startTime);
        const endDate = new Date(endTime);

        if (startDate >= endDate) {
            return res.status(400).json({
                message: "startTime must be before endTime"
            });
        }
    }

    next();
};

const validateQuizSubmission = (req, res, next) => {
    const { error } = quizSubmissionSchema.validate(req.body, { abortEarly: false });

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

const validateLeaderboardFilter = (req, res, next) => {
    const { error } = leaderboardFilterSchema.validate(req.query, { abortEarly: false });

    if (error) {
        const errors = error.details.map(detail => ({
            field: detail.path.join('.'),
            message: detail.message
        }));

        return res.status(400).json({
            message: 'Leaderboard filter validation failed',
            errors
        });
    }

    next();
};

module.exports = {
    validateQuizGroup,
    validateQuizSubmission,
    validateFilter,
    validateLeaderboardFilter,
    validateFile,
    questionSchema,
    quizGroupSchema
};