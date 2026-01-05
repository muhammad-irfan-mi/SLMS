const Joi = require("joi");
const mongoose = require("mongoose");

const objectId = Joi.string().custom((value, helpers) => {
    if (!mongoose.Types.ObjectId.isValid(value)) {
        return helpers.message("Invalid ObjectId");
    }
    return value;
}, "ObjectId validation");

// Common date format validation (YYYY-MM-DD)
const dateFormat = Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).message("Date must be in YYYY-MM-DD format");

// Apply leave validation
exports.applyLeaveSchema = Joi.object({
    classId: objectId.required()
        .messages({
            'any.required': 'Class ID is required',
            'string.base': 'Class ID must be a string'
        }),
    sectionId: objectId.required()
        .messages({
            'any.required': 'Section ID is required',
            'string.base': 'Section ID must be a string'
        }),
    dates: Joi.array().items(
        Joi.alternatives().try(
            Joi.string().isoDate(), // ISO date string
            dateFormat, // Already formatted date
            Joi.date() // Date object
        )
    ).min(1).max(30).required()
        .custom((value, helpers) => {
            // Check for duplicate dates
            const stringDates = value.map(date => {
                const d = new Date(date);
                return d.toISOString().split('T')[0];
            });

            const uniqueDates = [...new Set(stringDates)];
            if (stringDates.length !== uniqueDates.length) {
                return helpers.error('any.custom', {
                    message: 'Duplicate dates found in the request'
                });
            }
            return value;
        })
        .messages({
            'array.min': 'At least one date is required',
            'array.max': 'Cannot apply leave for more than 30 days at once',
            'array.base': 'Dates must be an array',
            'any.required': 'Dates are required'
        }),
    subject: Joi.string().min(1).max(200).required()
        .messages({
            'string.min': 'Subject must be at least 1 character',
            'string.max': 'Subject cannot exceed 200 characters',
            'any.required': 'Subject is required'
        }),
    reason: Joi.string().min(1).max(1000).required()
        .messages({
            'string.min': 'Reason must be at least 1 character',
            'string.max': 'Reason cannot exceed 1000 characters',
            'any.required': 'Reason is required'
        })
});

// Cancel leave validation
exports.cancelLeaveSchema = Joi.object({
    id: objectId.required()
        .messages({
            'any.required': 'Leave ID is required'
        })
});

// Get leaves query validation
exports.getLeavesQuerySchema = Joi.object({
    classId: objectId.optional(),
    sectionId: objectId.optional(),
    studentId: objectId.optional(),
    date: Joi.alternatives().try(
        Joi.string().isoDate(),
        dateFormat,
        Joi.date()
    ).optional(),
    status: Joi.string().valid("pending", "approved", "rejected", "cancelled").optional(),
    startDate: dateFormat.optional(),
    endDate: dateFormat.optional(),
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(10)
}).custom((value, helpers) => {
    // If startDate is provided, endDate must also be provided
    if (value.startDate && !value.endDate) {
        return helpers.error('any.custom', {
            message: 'endDate is required when startDate is provided'
        });
    }
    // If endDate is provided, startDate must also be provided
    if (value.endDate && !value.startDate) {
        return helpers.error('any.custom', {
            message: 'startDate is required when endDate is provided'
        });
    }
    // If both dates are provided, startDate must be before or equal to endDate
    if (value.startDate && value.endDate) {
        if (value.startDate > value.endDate) {
            return helpers.error('any.custom', {
                message: 'startDate must be before or equal to endDate'
            });
        }
    }
    return value;
});

// Approve/Reject leave validation
exports.reviewLeaveSchema = Joi.object({
    remark: Joi.string().max(500).optional().allow('')
        .messages({
            'string.max': 'Remark cannot exceed 500 characters'
        })
});

// Get leaves by student validation
exports.getLeavesByStudentQuerySchema = Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(20),
    status: Joi.string().valid("pending", "approved", "rejected", "cancelled").optional(),
    startDate: dateFormat.optional(),
    endDate: dateFormat.optional()
}).custom((value, helpers) => {
    if (value.startDate && !value.endDate) {
        return helpers.error('any.custom', {
            message: 'endDate is required when startDate is provided'
        });
    }
    if (value.endDate && !value.startDate) {
        return helpers.error('any.custom', {
            message: 'startDate is required when endDate is provided'
        });
    }
    if (value.startDate && value.endDate && value.startDate > value.endDate) {
        return helpers.error('any.custom', {
            message: 'startDate must be before or equal to endDate'
        });
    }
    return value;
});

// Teacher leave application validation
// Teacher leave application validation
exports.applyTeacherLeaveSchema = Joi.object({
    dates: Joi.array().items(
        Joi.alternatives().try(
            Joi.string().isoDate(),
            dateFormat,
            Joi.date()
        )
    ).min(1).max(30).required()
        .custom((value, helpers) => {
            // Check for duplicate dates
            const stringDates = value.map(date => {
                const d = new Date(date);
                return d.toISOString().split('T')[0]; // YYYY-MM-DD format
            });

            const uniqueDates = [...new Set(stringDates)];
            if (stringDates.length !== uniqueDates.length) {
                return helpers.error('any.custom', {
                    message: 'Duplicate dates found in the request'
                });
            }
            return value;
        })
        .messages({
            'array.min': 'At least one date is required',
            'array.max': 'Cannot apply leave for more than 30 days at once',
            'array.base': 'Dates must be an array',
            'any.required': 'Dates are required'
        }),
    subject: Joi.string().min(1).max(200).required()
        .messages({
            'string.min': 'Subject must be at least 1 character',
            'string.max': 'Subject cannot exceed 200 characters',
            'any.required': 'Subject is required'
        }),
    reason: Joi.string().min(1).max(1000).required()
        .messages({
            'string.min': 'Reason must be at least 1 character',
            'string.max': 'Reason cannot exceed 1000 characters',
            'any.required': 'Reason is required'
        })
});

// Teacher leave update validation
exports.updateTeacherLeaveSchema = Joi.object({
    subject: Joi.string().min(1).max(200).optional()
        .messages({
            'string.min': 'Subject must be at least 1 character',
            'string.max': 'Subject cannot exceed 200 characters'
        }),
    reason: Joi.string().min(1).max(1000).optional()
        .messages({
            'string.min': 'Reason must be at least 1 character',
            'string.max': 'Reason cannot exceed 1000 characters'
        })
}).or('subject', 'reason')
    .messages({
        'object.missing': 'At least one field (subject or reason) is required to update'
    });

// Teacher get leaves query validation
exports.getTeacherLeavesQuerySchema = Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(20),
    status: Joi.string().valid("pending", "approved", "rejected", "cancelled").optional(),
    startDate: dateFormat.optional(),
    endDate: dateFormat.optional()
}).custom((value, helpers) => {
    if (value.startDate && !value.endDate) {
        return helpers.error('any.custom', {
            message: 'endDate is required when startDate is provided'
        });
    }
    if (value.endDate && !value.startDate) {
        return helpers.error('any.custom', {
            message: 'startDate is required when endDate is provided'
        });
    }
    if (value.startDate && value.endDate && value.startDate > value.endDate) {
        return helpers.error('any.custom', {
            message: 'startDate must be before or equal to endDate'
        });
    }
    return value;
});