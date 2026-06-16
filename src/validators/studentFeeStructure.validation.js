const Joi = require("joi");

const assignStudentFeeSchema = Joi.object({
    studentId: Joi.string().required(),
    classId: Joi.string().required(),

    fees: Joi.array()
        .items(
            Joi.object({
                feeComponent: Joi.string().required(),
                amount: Joi.number().min(0).optional(),
                type: Joi.string()
                    .valid("override", "custom", "exempt")
                    .default("override")
            })
        )
        .min(1)
        .required()
});

const updateStudentFeeSchema = Joi.object({
    amount: Joi.number().min(0),
    type: Joi.string().valid("override", "custom", "exempt"),
    isActive: Joi.boolean(),
}).min(1);

module.exports = {
    assignStudentFeeSchema,
    updateStudentFeeSchema,
};