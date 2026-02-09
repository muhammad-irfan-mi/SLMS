const Joi = require('joi');

const convert12to24 = (time) => {
  // Check if time has AM/PM indicator
  const timeUpper = time.toUpperCase();
  const hasAM = timeUpper.includes('AM');
  const hasPM = timeUpper.includes('PM');

  // Remove AM/PM and trim
  const cleanTime = time.replace(/[AP]M/i, '').trim();

  const [hoursStr, minutesStr] = cleanTime.split(':');
  let hours = parseInt(hoursStr, 10);
  const minutes = parseInt(minutesStr || '0', 10);

  // Convert to 24-hour format
  if (hasPM && hours < 12) {
    hours += 12;
  } else if (hasAM && hours === 12) {
    hours = 0;
  }

  // Format as HH:MM
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
};

const validateAndConvertTime = (value, helpers) => {
  const time24Regex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;

  // Check if it's in 12-hour format with AM/PM
  const time12Regex = /^(0?[1-9]|1[0-2]):[0-5][0-9]\s*[AP]M$/i;

  if (time24Regex.test(value)) {
    // Already in 24-hour format
    const [hours, minutes] = value.split(':').map(Number);
    if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
      return helpers.error('any.invalid', { message: 'Invalid time format' });
    }
    return value;
  } else if (time12Regex.test(value)) {
    // Convert from 12-hour to 24-hour format
    try {
      const time24 = convert12to24(value);
      return time24;
    } catch (error) {
      return helpers.error('any.invalid', { message: 'Invalid time format' });
    }
  } else {
    return helpers.error('any.invalid', {
      message: 'Time must be in HH:MM format (24-hour) or HH:MM AM/PM format (12-hour)'
    });
  }
};

const validateTimeRange = (value, helpers) => {
  const { startTime } = helpers.state.ancestors[0];
  if (!startTime) return value;

  const toMinutes = (time) => {
    const [h, m] = time.split(':').map(Number);
    return h * 60 + m;
  };

  let start = toMinutes(startTime);
  let end = toMinutes(value);

  // ✅ allow crossing noon / midnight
  if (end <= start) {
    end += 12 * 60; // move to next cycle
  }

  const duration = end - start;

  if (duration < 30) {
    return helpers.message('Minimum schedule duration is 30 minutes');
  }

  if (duration > 120) {
    return helpers.message('Maximum schedule duration is 120 minutes');
  }

  return value;
};


// Common validation schemas
const timeFormatValidation = Joi.string()
  .custom(validateAndConvertTime, 'Time format validation and conversion')
  .required()
  .messages({
    'any.invalid': '{{#label}} must be in HH:MM format (24-hour) or HH:MM AM/PM format (e.g., 01:30 PM, 09:45 AM, 13:20)',
    'any.required': 'Time is required',
  });

const updateTimeFormatValidation = Joi.string()
  .custom(validateAndConvertTime, 'Time format validation and conversion')
  .messages({
    'any.invalid': '{{#label}} must be in HH:MM format (24-hour) or HH:MM AM/PM format (e.g., 01:30 PM, 09:45 AM, 13:20)',
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

// Single schedule validation
const singleScheduleValidation = Joi.object({
  classId: Joi.string()
    .pattern(/^[0-9a-fA-F]{24}$/)
    .required()
    .messages({
      'string.pattern.base': 'Invalid class ID format',
      'any.required': 'Class ID is required'
    }),

  sectionIds: Joi.array()
    .items(
      Joi.string()
        .pattern(/^[0-9a-fA-F]{24}$/)
        .required()
    )
    .min(1)
    .required()
    .messages({
      'array.base': 'Section IDs must be an array',
      'array.min': 'At least one section ID is required',
      'any.required': 'Section IDs are required'
    }),

  day: dayValidation,

  type: typeValidation,

  subjectId: Joi.when('type', {
    is: 'subject',
    then: Joi.string()
      .pattern(/^[0-9a-fA-F]{24}$/)
      .required()
      .messages({
        'string.pattern.base': 'Invalid subject ID format',
        'any.required': 'Subject ID is required for subject type'
      }),
    otherwise: Joi.string()
      .pattern(/^[0-9a-fA-F]{24}$/)
      .allow(null, '')
      .optional()
  }),

  teacherId: Joi.when('type', {
    is: 'subject',
    then: Joi.string()
      .pattern(/^[0-9a-fA-F]{24}$/)
      .required()
      .messages({
        'string.pattern.base': 'Invalid teacher ID format',
        'any.required': 'Teacher ID is required for subject type'
      }),
    otherwise: Joi.string()
      .pattern(/^[0-9a-fA-F]{24}$/)
      .allow(null, '')
      .optional()
  }),

  startTime: timeFormatValidation,

  endTime: Joi.string()
    .custom(validateAndConvertTime, 'Time format validation and conversion')
    .custom(validateTimeRange, 'Time range validation')
    .required()
    .messages({
      'any.invalid': '{{#label}} must be in HH:MM format and after start time',
      'any.custom': '{{#error}}',
      'any.required': 'End time is required'
    })
});

// Add schedule validation
const addScheduleValidation = Joi.object({
  schedules: Joi.array()
    .items(singleScheduleValidation)
    .min(1)
    .required()
    .custom((schedules, helpers) => {
      // Check for duplicate class-section-day-time combinations within the same request
      const seen = new Set();
      const duplicates = [];

      schedules.forEach((schedule, index) => {
        schedule.sectionIds.forEach(sectionId => {
          const key = `${schedule.classId}-${sectionId}-${schedule.day}-${schedule.startTime}-${schedule.endTime}`;
          if (seen.has(key)) {
            duplicates.push({
              index,
              classId: schedule.classId,
              sectionId,
              day: schedule.day,
              time: `${schedule.startTime}-${schedule.endTime}`
            });
          } else {
            seen.add(key);
          }
        });
      });

      if (duplicates.length > 0) {
        const errors = duplicates.map(d =>
          `Duplicate schedule for class-section ${d.classId}-${d.sectionId} on ${d.day} at ${d.time}`
        );
        return helpers.error('any.custom', {
          message: errors.join('; ')
        });
      }

      return schedules;
    }, 'Duplicate schedule validation')
    .messages({
      'array.base': 'Schedules must be an array',
      'array.min': 'At least one schedule is required',
      'any.required': 'Schedules are required',
      'any.custom': '{{#error}}'
    })
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
  startTime: updateTimeFormatValidation,
  endTime: Joi.when('startTime', {
    is: Joi.exist(),
    then: updateTimeFormatValidation
      .custom(validateTimeRange, 'Time range validation')
      .required()
      .messages({
        'any.required': 'End time is required when start time is provided',
        'any.invalid': 'End time must be in HH:MM format and after start time',
        'any.custom': '{{#error}}'
      }),
    otherwise: updateTimeFormatValidation
  })
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