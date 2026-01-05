// const Joi = require("joi");
// const mongoose = require("mongoose");

// const objectId = Joi.string().custom((value, helpers) => {
//     if (!mongoose.Types.ObjectId.isValid(value))
//         return helpers.message("Invalid ObjectId");
//     return value;
// });

// exports.markAttendanceSchema = Joi.object({
//     classId: objectId.required(),
//     sectionId: objectId.required(),
//     date: Joi.string().optional(), 
//     students: Joi.array().items(
//         Joi.object({
//             studentId: objectId.required(),
//             status: Joi.string().valid("present", "absent", "leave").optional()
//         })
//     ).min(1).required()
// });

// exports.updateAttendanceSchema = Joi.object({
//     students: Joi.array().items(
//         Joi.object({
//             studentId: objectId.required(),
//             status: Joi.string().valid("present", "absent", "leave").required()
//         })
//     ).min(1).required()
// });

// exports.paginationSchema = Joi.object({
//     page: Joi.number().integer().min(1).default(1),
//     limit: Joi.number().integer().min(1).max(100).default(20)
// });

// exports.dateFilterSchema = Joi.object({
//     date: Joi.string().optional(),
//     startDate: Joi.string().optional(),
//     endDate: Joi.string().optional()
// }).xor("date", "startDate");

// exports.studentAttendanceQuerySchema = Joi.object({
//   page: Joi.number().integer().min(1).default(1),
//   limit: Joi.number().integer().min(1).max(100).default(20),

//   date: Joi.string().optional(),
//   startDate: Joi.string().optional(),
//   endDate: Joi.string().optional(),

//   status: Joi.string().valid("present", "absent", "leave").optional()
// })
// .oxor("date", "startDate")
// .with("startDate", "endDate");







const Joi = require("joi");
const mongoose = require("mongoose");

const objectId = Joi.string().custom((value, helpers) => {
    if (!mongoose.Types.ObjectId.isValid(value)) {
        return helpers.message("Invalid ObjectId");
    }
    return value;
}, "ObjectId validation");

const dateFormat = Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/)
    .message("Date must be in YYYY-MM-DD format");

exports.markAttendanceSchema = Joi.object({
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
    date: Joi.alternatives().try(
        Joi.string().isoDate(),
        dateFormat,
        Joi.date()
    ).required()
    .messages({
        'any.required': 'Date is required',
        'alternatives.match': 'Date must be a valid date string or object'
    }),
    students: Joi.array().items(
        Joi.object({
            studentId: objectId.required()
                .messages({
                    'any.required': 'Student ID is required for each student'
                }),
            status: Joi.string().valid("present", "absent", "leave").optional()
                .default("present")
                .messages({
                    'any.only': 'Status must be one of: present, absent, leave'
                })
        })
    ).min(1).required()
    .messages({
        'array.min': 'At least one student is required',
        'array.base': 'Students must be an array',
        'any.required': 'Students array is required'
    })
}).custom((value, helpers) => {
    // Check for duplicate student IDs in the array
    const studentIds = value.students.map(s => s.studentId);
    const uniqueIds = [...new Set(studentIds)];
    
    if (studentIds.length !== uniqueIds.length) {
        return helpers.error('any.custom', {
            message: 'Duplicate student IDs found in students array'
        });
    }
    return value;
});

exports.updateAttendanceSchema = Joi.object({
    students: Joi.array().items(
        Joi.object({
            studentId: objectId.required()
                .messages({
                    'any.required': 'Student ID is required for each student'
                }),
            status: Joi.string().valid("present", "absent", "leave").required()
                .messages({
                    'any.only': 'Status must be one of: present, absent, leave',
                    'any.required': 'Status is required for each student'
                })
        })
    ).min(1).required()
    .messages({
        'array.min': 'At least one student is required',
        'array.base': 'Students must be an array',
        'any.required': 'Students array is required'
    })
}).custom((value, helpers) => {
    // Check for duplicate student IDs
    const studentIds = value.students.map(s => s.studentId);
    const uniqueIds = [...new Set(studentIds)];
    
    if (studentIds.length !== uniqueIds.length) {
        return helpers.error('any.custom', {
            message: 'Duplicate student IDs found in students array'
        });
    }
    return value;
});

exports.paginationSchema = Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(20)
});

exports.dateFilterSchema = Joi.object({
    date: dateFormat.optional(),
    startDate: dateFormat.optional(),
    endDate: dateFormat.optional()
}).custom((value, helpers) => {
    // Validate date combinations
    if (value.date && (value.startDate || value.endDate)) {
        return helpers.error('any.custom', {
            message: 'Cannot provide both date and startDate/endDate'
        });
    }
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

exports.studentAttendanceQuerySchema = Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(20),
    date: dateFormat.optional(),
    startDate: dateFormat.optional(),
    endDate: dateFormat.optional(),
    status: Joi.string().valid("present", "absent", "leave").optional()
}).custom((value, helpers) => {
    if (value.date && (value.startDate || value.endDate)) {
        return helpers.error('any.custom', {
            message: 'Cannot provide both date and startDate/endDate'
        });
    }
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

// Section ID param validation
exports.sectionIdParamSchema = Joi.object({
    sectionId: objectId.required()
        .messages({
            'any.required': 'Section ID is required'
        })
});

// Student ID param validation
exports.studentIdParamSchema = Joi.object({
    studentId: objectId.required()
        .messages({
            'any.required': 'Student ID is required'
        })
});

// Attendance ID param validation
exports.attendanceIdParamSchema = Joi.object({
    attendanceId: objectId.required()
        .messages({
            'any.required': 'Attendance ID is required'
        })
});