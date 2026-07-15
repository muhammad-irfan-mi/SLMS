// validators/expense.validation.js
const Joi = require('joi');
const mongoose = require('mongoose');

const objectId = Joi.string().custom((value, helpers) => {
    if (!mongoose.Types.ObjectId.isValid(value)) {
        return helpers.message('Invalid ObjectId');
    }
    return value;
}, 'ObjectId validation');

const createExpenseSchema = Joi.object({
    title: Joi.string().min(3).max(200).required(),
    description: Joi.string().max(1000).optional().allow(''),
    category: Joi.string().valid(
        'salary', 'utilities', 'maintenance', 'supplies', 'equipment',
        'marketing', 'transport', 'food', 'events', 'insurance',
        'taxes', 'rent', 'professional_services', 'technology',
        'training', 'other'
    ).required(),
    amount: Joi.number().positive().required(),
    date: Joi.date().iso().default(Date.now),
    paymentMethod: Joi.string().valid('cash', 'bank').default('cash'),
    bankAccountId: Joi.string().hex().length(24).when('paymentMethod', {
        is: 'bank',
        then: Joi.required(),
        otherwise: Joi.optional()
    }),
    cashAccountId: Joi.string().hex().length(24).when('paymentMethod', {
        is: 'cash',
        then: Joi.required(),
        otherwise: Joi.optional()
    }),
    status: Joi.string().valid('pending', 'approved', 'paid', 'cancelled').default('pending')
});

const updateExpenseSchema = Joi.object({
    title: Joi.string().min(3).max(200).optional(),
    description: Joi.string().max(1000).optional().allow(''),
    category: Joi.string().valid(
        'salary', 'utilities', 'maintenance', 'supplies', 'equipment',
        'marketing', 'transport', 'food', 'events', 'insurance',
        'taxes', 'rent', 'professional_services', 'technology',
        'training', 'other'
    ).optional(),
    amount: Joi.number().positive().optional(),
    date: Joi.date().iso().optional(),
    paymentMethod: Joi.string().valid('cash', 'bank').optional(),
    bankAccountId: Joi.string().hex().length(24).when('paymentMethod', {
        is: 'bank',
        then: Joi.required(),
        otherwise: Joi.optional()
    }),
    cashAccountId: Joi.string().hex().length(24).when('paymentMethod', {
        is: 'cash',
        then: Joi.required(),
        otherwise: Joi.optional()
    }),
    status: Joi.string().valid('pending', 'approved', 'paid', 'cancelled').optional()
});

const getExpensesSchema = Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(20),
    category: Joi.string().valid(
        'salary', 'utilities', 'maintenance', 'supplies', 'equipment',
        'marketing', 'transport', 'food', 'events', 'insurance',
        'taxes', 'rent', 'professional_services', 'technology',
        'training', 'other'
    ).optional(),
    status: Joi.string().valid('pending', 'approved', 'paid', 'cancelled').optional(),
    startDate: Joi.date().iso().optional(),
    endDate: Joi.date().iso().optional(),
    minAmount: Joi.number().min(0).optional(),
    maxAmount: Joi.number().min(0).optional(),
    search: Joi.string().max(100).optional(),
    sortBy: Joi.string().valid('date', 'amount', 'createdAt', 'title').default('date'),
    sortOrder: Joi.string().valid('asc', 'desc').default('desc')
});

const idParamSchema = Joi.object({
    id: objectId.required()
});

module.exports = {
    createExpenseSchema,
    updateExpenseSchema,
    getExpensesSchema,
    idParamSchema
};