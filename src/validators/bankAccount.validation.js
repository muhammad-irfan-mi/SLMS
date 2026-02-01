const Joi = require('joi');

const createBankAccountSchema = Joi.object({
    accountHolderName: Joi.string()
        .required()
        .trim()
        .min(2)
        .max(100)
        .messages({
            'string.base': 'Account holder name must be a string',
            'string.empty': 'Account holder name is required',
            'string.min': 'Account holder name must be at least 2 characters long',
            'string.max': 'Account holder name cannot exceed 100 characters',
            'any.required': 'Account holder name is required'
        }),

    accountNumber: Joi.string()
        .required()
        .trim()
        .pattern(/^[0-9]{9,18}$/)
        .messages({
            'string.base': 'Account number must be a string',
            'string.empty': 'Account number is required',
            'string.pattern.base': 'Account number must be 9-18 digits',
            'any.required': 'Account number is required'
        }),

    bankName: Joi.string()
        .required()
        .trim()
        .min(2)
        .max(100)
        .messages({
            'string.base': 'Bank name must be a string',
            'string.empty': 'Bank name is required',
            'string.min': 'Bank name must be at least 2 characters long',
            'string.max': 'Bank name cannot exceed 100 characters',
            'any.required': 'Bank name is required'
        }),

    branchName: Joi.string()
        .optional()
        .trim()
        .min(2)
        .max(100)
        .allow('')
        .messages({
            'string.base': 'Branch name must be a string',
            'string.min': 'Branch name must be at least 2 characters long',
            'string.max': 'Branch name cannot exceed 100 characters'
        }),

    accountType: Joi.string()
        .valid('saving', 'current', 'salary')
        .default('saving')
        .messages({
            'string.base': 'Account type must be a string',
            'any.only': 'Account type must be one of: saving, current, salary'
        }),

    ifscCode: Joi.string()
        .required()
        .trim()
        .pattern(/^[A-Z]{4}0[A-Z0-9]{6}$/)
        .uppercase()
        .messages({
            'string.base': 'IFSC code must be a string',
            'string.empty': 'IFSC code is required',
            'string.pattern.base': 'Invalid IFSC code format (e.g., SBIN0001234)',
            'any.required': 'IFSC code is required'
        })
});

// Update Bank Account Schema
const updateBankAccountSchema = Joi.object({
    accountHolderName: Joi.string()
        .optional()
        .trim()
        .min(2)
        .max(100)
        .messages({
            'string.base': 'Account holder name must be a string',
            'string.min': 'Account holder name must be at least 2 characters long',
            'string.max': 'Account holder name cannot exceed 100 characters'
        }),

    accountNumber: Joi.string()
        .optional()
        .trim()
        .pattern(/^[0-9]{9,18}$/)
        .messages({
            'string.base': 'Account number must be a string',
            'string.pattern.base': 'Account number must be 9-18 digits'
        }),

    bankName: Joi.string()
        .optional()
        .trim()
        .min(2)
        .max(100)
        .messages({
            'string.base': 'Bank name must be a string',
            'string.min': 'Bank name must be at least 2 characters long',
            'string.max': 'Bank name cannot exceed 100 characters'
        }),

    branchName: Joi.string()
        .optional()
        .trim()
        .min(2)
        .max(100)
        .allow('')
        .messages({
            'string.base': 'Branch name must be a string',
            'string.min': 'Branch name must be at least 2 characters long',
            'string.max': 'Branch name cannot exceed 100 characters'
        }),

    accountType: Joi.string()
        .optional()
        .valid('saving', 'current', 'salary')
        .messages({
            'string.base': 'Account type must be a string',
            'any.only': 'Account type must be one of: saving, current, salary'
        }),

    ifscCode: Joi.string()
        .optional()
        .trim()
        .pattern(/^[A-Z]{4}0[A-Z0-9]{6}$/)
        .uppercase()
        .messages({
            'string.base': 'IFSC code must be a string',
            'string.pattern.base': 'Invalid IFSC code format (e.g., SBIN0001234)'
        }),

    isActive: Joi.boolean()
        .optional()
        .messages({
            'boolean.base': 'isActive must be a boolean'
        })
});

// Get Bank Accounts Query Schema (for listing with filters)
const getBankAccountsQuerySchema = Joi.object({
    page: Joi.number()
        .integer()
        .min(1)
        .default(1)
        .messages({
            'number.base': 'Page must be a number',
            'number.integer': 'Page must be an integer',
            'number.min': 'Page must be at least 1'
        }),

    limit: Joi.number()
        .integer()
        .min(1)
        .max(100)
        .default(10)
        .messages({
            'number.base': 'Limit must be a number',
            'number.integer': 'Limit must be an integer',
            'number.min': 'Limit must be at least 1',
            'number.max': 'Limit cannot exceed 100'
        }),

    isActive: Joi.boolean()
        .optional()
        .messages({
            'boolean.base': 'isActive must be a boolean'
        }),

    accountType: Joi.string()
        .optional()
        .valid('saving', 'current', 'salary')
        .messages({
            'string.base': 'Account type must be a string',
            'any.only': 'Account type must be one of: saving, current, salary'
        }),

    search: Joi.string()
        .optional()
        .trim()
        .max(100)
        .allow('')
        .messages({
            'string.base': 'Search term must be a string',
            'string.max': 'Search term cannot exceed 100 characters'
        }),

    sortBy: Joi.string()
        .valid('createdAt', 'accountHolderName', 'bankName', 'accountNumber')
        .default('createdAt')
        .messages({
            'string.base': 'Sort by must be a string',
            'any.only': 'Sort by must be one of: createdAt, accountHolderName, bankName, accountNumber'
        }),

    sortOrder: Joi.string()
        .valid('asc', 'desc')
        .default('desc')
        .messages({
            'string.base': 'Sort order must be a string',
            'any.only': 'Sort order must be one of: asc, desc'
        })
});

// Validation middleware function
const validateBody = (schema) => {
    return (req, res, next) => {
        const { error, value } = schema.validate(req.body, { abortEarly: false });
        
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
};

const validateQuery = (schema) => {
    return (req, res, next) => {
        const { error, value } = schema.validate(req.query, { abortEarly: false });
        
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
};

module.exports = {
    createBankAccountSchema,
    updateBankAccountSchema,
    getBankAccountsQuerySchema,
    validateBody,
    validateQuery
};