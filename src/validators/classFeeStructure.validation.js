const Joi = require("joi");

const assignClassFeeSchema = Joi.object({
    classId: Joi.string().required(),

    fees: Joi.array()
        .items(
            Joi.object({
                feeComponent: Joi.string().required(),
                amount: Joi.number().min(0)
            })
        )
        .min(1)
        .required()
});

const updateClassFeeSchema = Joi.object({
    amount: Joi.number().min(0),
    isActive: Joi.boolean(),
}).min(1);

module.exports = {
    assignClassFeeSchema,
    updateClassFeeSchema,
};