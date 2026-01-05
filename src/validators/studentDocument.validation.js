// validation/documentSystem.validation.js
const Joi = require('joi');

// Common patterns
const objectIdPattern = /^[0-9a-fA-F]{24}$/;
const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

// Create document request validation
const createDocumentRequestSchema = Joi.object({
  studentId: Joi.string()
    .pattern(objectIdPattern)
    .required()
    .messages({
      'string.pattern.base': 'Invalid student ID format',
      'any.required': 'Student ID is required'
    }),

  classId: Joi.string()
    .pattern(objectIdPattern)
    .required()
    .messages({
      'string.pattern.base': 'Invalid class ID format',
      'any.required': 'Class ID is required'
    }),

  sectionId: Joi.string()
    .pattern(objectIdPattern)
    .required()
    .messages({
      'string.pattern.base': 'Invalid section ID format',
      'any.required': 'Section ID is required'
    }),

  title: Joi.string()
    .min(3)
    .max(200)
    .required()
    .messages({
      'string.min': 'Title must be at least 3 characters',
      'string.max': 'Title cannot exceed 200 characters',
      'any.required': 'Title is required'
    }),

  description: Joi.string()
    .min(10)
    .max(1000)
    .required()
    .messages({
      'string.min': 'Description must be at least 10 characters',
      'string.max': 'Description cannot exceed 1000 characters',
      'any.required': 'Description is required'
    }),

  requestType: Joi.string()
    .valid('document', 'question', 'data')
    .default('document')
    .messages({
      'any.only': 'Request type must be one of: document, question, data'
    }),

  documentType: Joi.string()
    .valid('assignment', 'homework', 'certificate', 'form', 'report', 'other')
    .default('other')
    .messages({
      'any.only': 'Document type must be one of: assignment, homework, certificate, form, report, other'
    }),

  dueDate: Joi.string()
    .pattern(dateRegex)
    .optional()
    .messages({
      'string.pattern.base': 'Due date must be in YYYY-MM-DD format'
    })
});

// Update document request validation
const updateDocumentRequestSchema = Joi.object({
  title: Joi.string()
    .min(3)
    .max(200)
    .optional()
    .messages({
      'string.min': 'Title must be at least 3 characters',
      'string.max': 'Title cannot exceed 200 characters'
    }),

  description: Joi.string()
    .min(10)
    .max(1000)
    .optional()
    .messages({
      'string.min': 'Description must be at least 10 characters',
      'string.max': 'Description cannot exceed 1000 characters'
    }),

  dueDate: Joi.string()
    .pattern(dateRegex)
    .optional()
    .messages({
      'string.pattern.base': 'Due date must be in YYYY-MM-DD format'
    }),

  status: Joi.string()
    .valid('pending', 'reviewed', 'approved', 'rejected')
    .optional()
    .messages({
      'any.only': 'Status must be one of: pending, reviewed, approved, rejected'
    }),

  reviewComments: Joi.string()
    .max(500)
    .optional()
    .messages({
      'string.max': 'Review comments cannot exceed 500 characters'
    })
}).min(1).messages({
  'object.min': 'At least one field must be provided for update'
});

// Upload document for request validation
const uploadForRequestSchema = Joi.object({
  requestId: Joi.string()
    .pattern(objectIdPattern)
    .required()
    .messages({
      'string.pattern.base': 'Invalid request ID format',
      'any.required': 'Request ID is required'
    }),

  text: Joi.string()
    .max(2000)
    .allow('', null)
    .optional()
    .messages({
      'string.max': 'Text cannot exceed 2000 characters'
    })
});

// Upload general document validation
const uploadGeneralDocumentSchema = Joi.object({
  classId: Joi.string()
    .pattern(objectIdPattern)
    .required()
    .messages({
      'string.pattern.base': 'Invalid class ID format',
      'any.required': 'Class ID is required'
    }),

  sectionId: Joi.string()
    .pattern(objectIdPattern)
    .required()
    .messages({
      'string.pattern.base': 'Invalid section ID format',
      'any.required': 'Section ID is required'
    }),

  text: Joi.string()
    .max(2000)
    .allow('', null)
    .optional()
    .messages({
      'string.max': 'Text cannot exceed 2000 characters'
    }),

  uploadedFor: Joi.string()
    .valid('teacher', 'admin_office', 'school')
    .default('admin_office')
    .messages({
      'any.only': 'uploadedFor must be one of: teacher, admin_office, school'
    }),

  requestType: Joi.string()
    .valid('document', 'question', 'data')
    .optional()
    .messages({
      'any.only': 'Request type must be one of: document, question, data'
    }),

  requestDetails: Joi.string()
    .max(1000)
    .optional()
    .messages({
      'string.max': 'Request details cannot exceed 1000 characters'
    })
});

// Update document validation
const updateDocumentSchema = Joi.object({
  text: Joi.string()
    .max(2000)
    .allow('', null)
    .optional()
    .messages({
      'string.max': 'Text cannot exceed 2000 characters'
    }),

  uploadedFor: Joi.string()
    .valid('teacher', 'admin_office', 'school')
    .optional()
    .messages({
      'any.only': 'uploadedFor must be one of: teacher, admin_office, school'
    })
}).min(1).messages({
  'object.min': 'At least one field must be provided for update'
});

// Update document status validation
const updateDocumentStatusSchema = Joi.object({
  status: Joi.string()
    .valid('reviewed', 'approved', 'rejected')
    .required()
    .messages({
      'any.only': 'Status must be one of: reviewed, approved, rejected',
      'any.required': 'Status is required'
    }),

  reviewComments: Joi.string()
    .max(500)
    .optional()
    .messages({
      'string.max': 'Review comments cannot exceed 500 characters'
    })
});

// Get document requests query validation
const getDocumentRequestsQuerySchema = Joi.object({
  studentId: Joi.string()
    .pattern(objectIdPattern)
    .optional()
    .messages({
      'string.pattern.base': 'Invalid student ID format'
    }),

  classId: Joi.string()
    .pattern(objectIdPattern)
    .optional()
    .messages({
      'string.pattern.base': 'Invalid class ID format'
    }),

  sectionId: Joi.string()
    .pattern(objectIdPattern)
    .optional()
    .messages({
      'string.pattern.base': 'Invalid section ID format'
    }),

  requestType: Joi.string()
    .valid('document', 'question', 'data')
    .optional()
    .messages({
      'any.only': 'Request type must be one of: document, question, data'
    }),

  documentType: Joi.string()
    .valid('assignment', 'homework', 'certificate', 'form', 'report', 'other')
    .optional()
    .messages({
      'any.only': 'Document type must be one of: assignment, homework, certificate, form, report, other'
    }),

  status: Joi.string()
    .valid('pending', 'uploaded', 'reviewed', 'approved', 'rejected', 'expired')
    .optional()
    .messages({
      'any.only': 'Status must be one of: pending, uploaded, reviewed, approved, rejected, expired'
    }),

  requestedBy: Joi.string()
    .pattern(objectIdPattern)
    .optional()
    .messages({
      'string.pattern.base': 'Invalid requestedBy ID format'
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
    .valid('createdAt', 'updatedAt', 'dueDate')
    .default('createdAt')
    .messages({
      'any.only': 'Sort by must be one of: createdAt, updatedAt, dueDate'
    }),

  sortOrder: Joi.string()
    .valid('asc', 'desc')
    .default('desc')
    .messages({
      'any.only': 'Sort order must be "asc" or "desc"'
    })
});

// Get documents query validation
const getDocumentsQuerySchema = Joi.object({
  classId: Joi.string()
    .pattern(objectIdPattern)
    .optional()
    .messages({
      'string.pattern.base': 'Invalid class ID format'
    }),

  sectionId: Joi.string()
    .pattern(objectIdPattern)
    .optional()
    .messages({
      'string.pattern.base': 'Invalid section ID format'
    }),

  studentId: Joi.string()
    .pattern(objectIdPattern)
    .optional()
    .messages({
      'string.pattern.base': 'Invalid student ID format'
    }),

  teacher: Joi.string()
    .valid('true', 'false')
    .optional()
    .messages({
      'any.only': 'teacher must be either "true" or "false"'
    }),

  admin: Joi.string()
    .valid('true', 'false')
    .optional()
    .messages({
      'any.only': 'admin must be either "true" or "false"'
    }),

  school: Joi.string()
    .valid('true', 'false')
    .optional()
    .messages({
      'any.only': 'school must be either "true" or "false"'
    }),

  requestedBy: Joi.string()
    .pattern(objectIdPattern)
    .optional()
    .messages({
      'string.pattern.base': 'Invalid requestedBy ID format'
    }),

  requestType: Joi.string()
    .valid('document', 'question', 'data')
    .optional()
    .messages({
      'any.only': 'Request type must be one of: document, question, data'
    }),

  status: Joi.string()
    .valid('pending', 'submitted', 'reviewed', 'approved', 'rejected')
    .optional()
    .messages({
      'any.only': 'Status must be one of: pending, submitted, reviewed, approved, rejected'
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
    .valid('createdAt', 'updatedAt')
    .default('createdAt')
    .messages({
      'any.only': 'Sort by must be one of: createdAt, updatedAt'
    }),

  sortOrder: Joi.string()
    .valid('asc', 'desc')
    .default('desc')
    .messages({
      'any.only': 'Sort order must be "asc" or "desc"'
    })
});

// Get student documents query validation
const getStudentDocumentsQuerySchema = Joi.object({
  uploadedFor: Joi.string()
    .valid('teacher', 'admin_office', 'school')
    .optional()
    .messages({
      'any.only': 'uploadedFor must be one of: teacher, admin_office, school'
    }),

  requestedBy: Joi.string()
    .pattern(objectIdPattern)
    .optional()
    .messages({
      'string.pattern.base': 'Invalid requestedBy ID format'
    }),

  requestType: Joi.string()
    .valid('document', 'question', 'data')
    .optional()
    .messages({
      'any.only': 'Request type must be one of: document, question, data'
    }),

  status: Joi.string()
    .valid('pending', 'submitted', 'reviewed', 'approved', 'rejected')
    .optional()
    .messages({
      'any.only': 'Status must be one of: pending, submitted, reviewed, approved, rejected'
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
    .max(50)
    .default(10)
    .messages({
      'number.min': 'Limit must be at least 1',
      'number.max': 'Limit cannot exceed 50',
      'number.integer': 'Limit must be an integer'
    })
});

// File validation helper
const validateFiles = (files, maxFiles = 5, maxSizeMB = 10) => {
  if (files && files.length > maxFiles) {
    throw new Error(`Maximum ${maxFiles} files allowed`);
  }
  
  files?.forEach(file => {
    if (file.size > maxSizeMB * 1024 * 1024) {
      throw new Error(`File ${file.originalname} exceeds ${maxSizeMB}MB limit`);
    }
    
    const allowedMimeTypes = [
      'application/pdf',
      'image/jpeg', 'image/jpg', 'image/png', 'image/gif',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ];
    
    if (!allowedMimeTypes.includes(file.mimetype)) {
      throw new Error(`File type ${file.mimetype} not allowed`);
    }
  });
};

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

module.exports = {
  createDocumentRequestSchema,
  updateDocumentRequestSchema,
  uploadForRequestSchema,
  uploadGeneralDocumentSchema,
  updateDocumentSchema,
  updateDocumentStatusSchema,
  getDocumentRequestsQuerySchema,
  getDocumentsQuerySchema,
  getStudentDocumentsQuerySchema,
  validateFiles,
  validateBody,
  validateQuery
};