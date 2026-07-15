const Joi = require("joi");

const createCashAccountSchema = Joi.object({
    title: Joi.string().trim().default('Cash Account'),
    description: Joi.string().trim().allow('', null),
    amount: Joi.number().min(0).default(0)
});

const updateCashAccountSchema = Joi.object({
    title: Joi.string().trim(),
    description: Joi.string().trim().allow('', null),
    amount: Joi.number().min(0)
}).min(1);

module.exports = {
    createCashAccountSchema,
    updateCashAccountSchema
};