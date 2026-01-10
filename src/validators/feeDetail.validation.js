const Joi = require('joi');
const mongoose = require('mongoose');

const createFeeDetailSchema = Joi.object({
    studentId: Joi.string().custom((value, helpers) => {
        if (!mongoose.Types.ObjectId.isValid(value)) {
            return helpers.error('any.invalid');
        }
        return value;
    }).required(),
    month: Joi.string().required(),
    amount: Joi.number().positive().required(),
    title: Joi.string().required(),
    description: Joi.string().allow(''),
});

const updateFeeDetailSchema = Joi.object({
    month: Joi.string(),
    amount: Joi.number().positive(),
    title: Joi.string(),
    description: Joi.string().allow(''),
});

const approvePaymentSchema = Joi.object({
    status: Joi.string().valid('approved', 'rejected').required(),
});

const getAllFeeDetailsSchema = Joi.object({
    page: Joi.number().integer().positive().default(1),
    limit: Joi.number().integer().positive().max(100).default(10),

    studentId: Joi.string().custom((value, helpers) => {
        if (!mongoose.Types.ObjectId.isValid(value)) {
            return helpers.error('any.invalid');
        }
        return value;
    }),

    month: Joi.string(),
    status: Joi.string().valid('pending', 'submitted', 'approved', 'rejected'),
});

const getMyFeeDetailsSchema = Joi.object({
    page: Joi.number().integer().positive().default(1),
    limit: Joi.number().integer().positive().max(50).default(10),
});


module.exports = {
    createFeeDetailSchema,
    updateFeeDetailSchema,
    approvePaymentSchema,
    getAllFeeDetailsSchema,
    getMyFeeDetailsSchema,
};