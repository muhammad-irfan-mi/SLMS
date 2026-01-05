// const Joi = require('joi');

// // Common validation schemas
// const timeFormatValidation = Joi.string().pattern(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/).required().messages({
//   'string.pattern.base': 'Time must be in HH:MM format (24-hour)',
//   'any.required': 'Time is required',
// });

// const dayValidation = Joi.string().valid(
//   "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"
// ).required().messages({
//   'any.only': 'Day must be a valid weekday',
//   'any.required': 'Day is required',
// });

// const typeValidation = Joi.string().valid("subject", "break", "holiday").required().messages({
//   'any.only': 'Type must be subject, break, or holiday',
//   'any.required': 'Type is required',
// });

// // Single schedule validation
// const singleScheduleValidation = Joi.object({
//   classId: Joi.string().hex().length(24).required().messages({
//     'string.hex': 'Class ID must be a valid hexadecimal string',
//     'string.length': 'Class ID must be 24 characters long',
//     'any.required': 'Class ID is required',
//   }),
//   sectionIds: Joi.array().items(
//     Joi.string().hex().length(24).required()
//   ).min(1).required().messages({
//     'array.base': 'Section IDs must be an array',
//     'array.min': 'At least one section ID is required',
//     'any.required': 'Section IDs are required',
//   }),
//   day: dayValidation,
//   type: typeValidation,
//   subjectId: Joi.when('type', {
//     is: 'subject',
//     then: Joi.string().hex().length(24).required().messages({
//       'string.hex': 'Subject ID must be a valid hexadecimal string',
//       'string.length': 'Subject ID must be 24 characters long',
//       'any.required': 'Subject ID is required for subject type',
//     }),
//     otherwise: Joi.string().hex().length(24).allow(null, '').optional()
//   }),
//   teacherId: Joi.when('type', {
//     is: 'subject',
//     then: Joi.string().hex().length(24).required().messages({
//       'string.hex': 'Teacher ID must be a valid hexadecimal string',
//       'string.length': 'Teacher ID must be 24 characters long',
//       'any.required': 'Teacher ID is required for subject type',
//     }),
//     otherwise: Joi.string().hex().length(24).allow(null, '').optional()
//   }),
//   startTime: timeFormatValidation,
//   endTime: timeFormatValidation,
// }).custom((value, helpers) => {
//   // Validate that endTime is after startTime
//   const start = value.startTime.split(':').map(Number);
//   const end = value.endTime.split(':').map(Number);
//   const startMinutes = start[0] * 60 + start[1];
//   const endMinutes = end[0] * 60 + end[1];
  
//   if (endMinutes <= startMinutes) {
//     return helpers.error('any.custom', {
//       message: 'End time must be after start time'
//     });
//   }
  
//   // Validate duration (minimum 30 minutes, maximum 120 minutes)
//   const duration = endMinutes - startMinutes;
//   if (duration < 30) {
//     return helpers.error('any.custom', {
//       message: 'Minimum schedule duration is 30 minutes'
//     });
//   }
//   if (duration > 120) {
//     return helpers.error('any.custom', {
//       message: 'Maximum schedule duration is 120 minutes'
//     });
//   }
  
//   return value;
// });

// // Add schedule validation
// const addScheduleValidation = Joi.object({
//   schedules: Joi.array().items(singleScheduleValidation).min(1).required().messages({
//     'array.base': 'Schedules must be an array',
//     'array.min': 'At least one schedule is required',
//     'any.required': 'Schedules are required',
//   }),
// });

// // Get schedule query validation
// const getScheduleValidation = Joi.object({
//   classId: Joi.string().hex().length(24).optional().messages({
//     'string.hex': 'Class ID must be a valid hexadecimal string',
//     'string.length': 'Class ID must be 24 characters long',
//   }),
//   sectionId: Joi.string().hex().length(24).optional().messages({
//     'string.hex': 'Section ID must be a valid hexadecimal string',
//     'string.length': 'Section ID must be 24 characters long',
//   }),
//   teacherId: Joi.string().hex().length(24).optional().messages({
//     'string.hex': 'Teacher ID must be a valid hexadecimal string',
//     'string.length': 'Teacher ID must be 24 characters long',
//   }),
//   day: Joi.string().valid(
//     "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"
//   ).optional().messages({
//     'any.only': 'Day must be a valid weekday',
//   }),
//   page: Joi.number().integer().min(1).default(1),
//   limit: Joi.number().integer().min(1).max(100).default(10),
// });

// // Get schedule by section validation
// const getScheduleBySectionValidation = Joi.object({
//   classId: Joi.string().hex().length(24).required().messages({
//     'string.hex': 'Class ID must be a valid hexadecimal string',
//     'string.length': 'Class ID must be 24 characters long',
//     'any.required': 'Class ID is required',
//   }),
//   sectionId: Joi.string().hex().length(24).required().messages({
//     'string.hex': 'Section ID must be a valid hexadecimal string',
//     'string.length': 'Section ID must be 24 characters long',
//     'any.required': 'Section ID is required',
//   }),
//   day: Joi.string().valid(
//     "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"
//   ).optional().messages({
//     'any.only': 'Day must be a valid weekday',
//   }),
//   page: Joi.number().integer().min(1).default(1),
//   limit: Joi.number().integer().min(1).max(100).default(10),
// });

// // Teacher schedule query validation
// const teacherScheduleValidation = Joi.object({
//   page: Joi.number().integer().min(1).default(1),
//   limit: Joi.number().integer().min(1).max(100).default(10),
//   day: Joi.string().valid(
//     "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"
//   ).optional().messages({
//     'any.only': 'Day must be a valid weekday',
//   }),
// });

// // Student schedule query validation
// const studentScheduleValidation = Joi.object({
//   page: Joi.number().integer().min(1).default(1),
//   limit: Joi.number().integer().min(1).max(100).default(10),
//   day: Joi.string().valid(
//     "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"
//   ).optional().messages({
//     'any.only': 'Day must be a valid weekday',
//   }),
// });

// // Update schedule validation
// const updateScheduleValidation = Joi.object({
//   classId: Joi.string().hex().length(24).optional().messages({
//     'string.hex': 'Class ID must be a valid hexadecimal string',
//     'string.length': 'Class ID must be 24 characters long',
//   }),
//   sectionId: Joi.string().hex().length(24).optional().messages({
//     'string.hex': 'Section ID must be a valid hexadecimal string',
//     'string.length': 'Section ID must be 24 characters long',
//   }),
//   day: dayValidation.optional(),
//   type: typeValidation.optional(),
//   subjectId: Joi.string().hex().length(24).allow(null, '').optional().messages({
//     'string.hex': 'Subject ID must be a valid hexadecimal string',
//     'string.length': 'Subject ID must be 24 characters long',
//   }),
//   teacherId: Joi.string().hex().length(24).allow(null, '').optional().messages({
//     'string.hex': 'Teacher ID must be a valid hexadecimal string',
//     'string.length': 'Teacher ID must be 24 characters long',
//   }),
//   startTime: timeFormatValidation.optional(),
//   endTime: timeFormatValidation.optional(),
// }).custom((value, helpers) => {
//   // Validate that endTime is after startTime if both are provided
//   if (value.startTime && value.endTime) {
//     const start = value.startTime.split(':').map(Number);
//     const end = value.endTime.split(':').map(Number);
//     const startMinutes = start[0] * 60 + start[1];
//     const endMinutes = end[0] * 60 + end[1];
    
//     if (endMinutes <= startMinutes) {
//       return helpers.error('any.custom', {
//         message: 'End time must be after start time'
//       });
//     }
    
//     // Validate duration (minimum 30 minutes, maximum 120 minutes)
//     const duration = endMinutes - startMinutes;
//     if (duration < 30) {
//       return helpers.error('any.custom', {
//         message: 'Minimum schedule duration is 30 minutes'
//       });
//     }
//     if (duration > 120) {
//       return helpers.error('any.custom', {
//         message: 'Maximum schedule duration is 120 minutes'
//       });
//     }
//   }
  
//   return value;
// });

// // ID parameter validation
// const idParamValidation = Joi.object({
//   id: Joi.string().hex().length(24).required().messages({
//     'string.hex': 'Schedule ID must be a valid hexadecimal string',
//     'string.length': 'Schedule ID must be 24 characters long',
//     'any.required': 'Schedule ID is required',
//   }),
// });

// module.exports = {
//   addScheduleValidation,
//   getScheduleValidation,
//   getScheduleBySectionValidation,
//   teacherScheduleValidation,
//   studentScheduleValidation,
//   updateScheduleValidation,
//   idParamValidation,
// };









const Joi = require('joi');

// Common validation schemas
const timeFormatValidation = Joi.string().pattern(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/).required().messages({
  'string.pattern.base': 'Time must be in HH:MM format (24-hour)',
  'any.required': 'Time is required',
});

const dayValidation = Joi.string().valid(
  "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"
).required().messages({
  'any.only': 'Day must be a valid weekday',
  'any.required': 'Day is required',
});

const typeValidation = Joi.string().valid("subject", "break", "holiday").required().messages({
  'any.only': 'Type must be subject, break, or holiday',
  'any.required': 'Type is required',
});

// Single schedule validation with custom error handling
const singleScheduleValidation = Joi.object({
  classId: Joi.string().hex().length(24).required().messages({
    'string.hex': 'Class ID must be a valid hexadecimal string',
    'string.length': 'Class ID must be 24 characters long',
    'any.required': 'Class ID is required',
  }),
  sectionIds: Joi.array().items(
    Joi.string().hex().length(24).required()
  ).min(1).required().messages({
    'array.base': 'Section IDs must be an array',
    'array.min': 'At least one section ID is required',
    'any.required': 'Section IDs are required',
  }),
  day: dayValidation,
  type: typeValidation,
  subjectId: Joi.when('type', {
    is: 'subject',
    then: Joi.string().hex().length(24).required().messages({
      'string.hex': 'Subject ID must be a valid hexadecimal string',
      'string.length': 'Subject ID must be 24 characters long',
      'any.required': 'Subject ID is required for subject type',
    }),
    otherwise: Joi.string().hex().length(24).allow(null, '').optional()
  }),
  teacherId: Joi.when('type', {
    is: 'subject',
    then: Joi.string().hex().length(24).required().messages({
      'string.hex': 'Teacher ID must be a valid hexadecimal string',
      'string.length': 'Teacher ID must be 24 characters long',
      'any.required': 'Teacher ID is required for subject type',
    }),
    otherwise: Joi.string().hex().length(24).allow(null, '').optional()
  }),
  startTime: timeFormatValidation,
  endTime: timeFormatValidation,
})
  .custom((value, helpers) => {
    const { startTime, endTime } = value;
    
    // Convert times to minutes
    const toMinutes = (time) => {
      const [hours, minutes] = time.split(':').map(Number);
      return hours * 60 + minutes;
    };
    
    const startMinutes = toMinutes(startTime);
    const endMinutes = toMinutes(endTime);
    
    // Check if end time is after start time
    if (endMinutes <= startMinutes) {
      throw new Error('End time must be after start time');
    }
    
    // Check duration
    const duration = endMinutes - startMinutes;
    if (duration < 30) {
      throw new Error('Minimum schedule duration is 30 minutes');
    }
    if (duration > 120) {
      throw new Error('Maximum schedule duration is 120 minutes');
    }
    
    return value;
  }, 'Time range validation')
  .messages({
    'any.custom': '{{#error}}', // This displays the custom error message
  });

// Add schedule validation
const addScheduleValidation = Joi.object({
  schedules: Joi.array().items(singleScheduleValidation).min(1).required().messages({
    'array.base': 'Schedules must be an array',
    'array.min': 'At least one schedule is required',
    'any.required': 'Schedules are required',
  }),
});

// Get schedule query validation
const getScheduleValidation = Joi.object({
  classId: Joi.string().hex().length(24).optional().messages({
    'string.hex': 'Class ID must be a valid hexadecimal string',
    'string.length': 'Class ID must be 24 characters long',
  }),
  sectionId: Joi.string().hex().length(24).optional().messages({
    'string.hex': 'Section ID must be a valid hexadecimal string',
    'string.length': 'Section ID must be 24 characters long',
  }),
  teacherId: Joi.string().hex().length(24).optional().messages({
    'string.hex': 'Teacher ID must be a valid hexadecimal string',
    'string.length': 'Teacher ID must be 24 characters long',
  }),
  day: Joi.string().valid(
    "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"
  ).optional().messages({
    'any.only': 'Day must be a valid weekday',
  }),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(10),
});

// Get schedule by section validation
const getScheduleBySectionValidation = Joi.object({
  classId: Joi.string().hex().length(24).required().messages({
    'string.hex': 'Class ID must be a valid hexadecimal string',
    'string.length': 'Class ID must be 24 characters long',
    'any.required': 'Class ID is required',
  }),
  sectionId: Joi.string().hex().length(24).required().messages({
    'string.hex': 'Section ID must be a valid hexadecimal string',
    'string.length': 'Section ID must be 24 characters long',
    'any.required': 'Section ID is required',
  }),
  day: Joi.string().valid(
    "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"
  ).optional().messages({
    'any.only': 'Day must be a valid weekday',
  }),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(10),
});

// Teacher schedule query validation
const teacherScheduleValidation = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(10),
  day: Joi.string().valid(
    "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"
  ).optional().messages({
    'any.only': 'Day must be a valid weekday',
  }),
});

// Student schedule query validation
const studentScheduleValidation = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(10),
  day: Joi.string().valid(
    "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"
  ).optional().messages({
    'any.only': 'Day must be a valid weekday',
  }),
});

// Update schedule validation
const updateScheduleValidation = Joi.object({
  classId: Joi.string().hex().length(24).optional().messages({
    'string.hex': 'Class ID must be a valid hexadecimal string',
    'string.length': 'Class ID must be 24 characters long',
  }),
  sectionId: Joi.string().hex().length(24).optional().messages({
    'string.hex': 'Section ID must be a valid hexadecimal string',
    'string.length': 'Section ID must be 24 characters long',
  }),
  day: dayValidation.optional(),
  type: typeValidation.optional(),
  subjectId: Joi.string().hex().length(24).allow(null, '').optional().messages({
    'string.hex': 'Subject ID must be a valid hexadecimal string',
    'string.length': 'Subject ID must be 24 characters long',
  }),
  teacherId: Joi.string().hex().length(24).allow(null, '').optional().messages({
    'string.hex': 'Teacher ID must be a valid hexadecimal string',
    'string.length': 'Teacher ID must be 24 characters long',
  }),
  startTime: timeFormatValidation.optional(),
  endTime: timeFormatValidation.optional(),
})
  .custom((value, helpers) => {
    const { startTime, endTime } = value;
    
    // Only validate if both times are provided
    if (startTime && endTime) {
      // Convert times to minutes
      const toMinutes = (time) => {
        const [hours, minutes] = time.split(':').map(Number);
        return hours * 60 + minutes;
      };
      
      const startMinutes = toMinutes(startTime);
      const endMinutes = toMinutes(endTime);
      
      // Check if end time is after start time
      if (endMinutes <= startMinutes) {
        throw new Error('End time must be after start time');
      }
      
      // Check duration
      const duration = endMinutes - startMinutes;
      if (duration < 30) {
        throw new Error('Minimum schedule duration is 30 minutes');
      }
      if (duration > 120) {
        throw new Error('Maximum schedule duration is 120 minutes');
      }
    }
    
    return value;
  }, 'Time range validation')
  .messages({
    'any.custom': '{{#error}}', // This displays the custom error message
  });

// ID parameter validation
const idParamValidation = Joi.object({
  id: Joi.string().hex().length(24).required().messages({
    'string.hex': 'Schedule ID must be a valid hexadecimal string',
    'string.length': 'Schedule ID must be 24 characters long',
    'any.required': 'Schedule ID is required',
  }),
});

module.exports = {
  addScheduleValidation,
  getScheduleValidation,
  getScheduleBySectionValidation,
  teacherScheduleValidation,
  studentScheduleValidation,
  updateScheduleValidation,
  idParamValidation,
};