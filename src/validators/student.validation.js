const Joi = require('joi');
const { commonValidations } = require('./common.validation');

const studentValidation = {
    add: Joi.object({
        name: commonValidations.name,
        username: commonValidations.username,
        email: commonValidations.email,
        phone: commonValidations.phone,
        address: commonValidations.address,
        cnic: commonValidations.cnic,
        fatherName: commonValidations.fatherName,
        classId: commonValidations.classId,
        sectionId: commonValidations.sectionId,
        rollNo: commonValidations.rollNo,
        parentEmail: commonValidations.emailOptional,
        isFixed: Joi.boolean()
            .default(false)
            .optional(),
        discount: Joi.number()
            .min(0)
            .max(100)
            .default(0)
            .optional()
            .messages({
                'number.min': 'Discount must be at least 0',
                'any.invalid': '{{message}}'
            })
    }),

    update: Joi.object({
        name: commonValidations.nameOptional,
        username: commonValidations.usernameOptional,
        email: commonValidations.emailOptional,
        phone: commonValidations.phone,
        address: commonValidations.address,
        cnic: commonValidations.cnic,
        fatherName: commonValidations.fatherName,
        classId: commonValidations.classIdOptional,
        sectionId: commonValidations.sectionIdOptional,
        rollNo: commonValidations.rollNo,
        parentEmail: commonValidations.emailOptional,
        isFixed: Joi.boolean().optional(),
        discount: Joi.number()
            .min(0)
            .max(100)
            .optional()
            .messages({
                'number.min': 'Discount must be at least 0',
                'any.invalid': '{{message}}'
            }),
        password: commonValidations.password.optional()
    }),

    auth: {
        sendOTP: Joi.object({
            email: commonValidations.email,
            username: commonValidations.username
        }),

        verifyOTP: Joi.object({
            email: commonValidations.email,
            username: commonValidations.username,
            otp: commonValidations.otp
        }),

        resendOTP: Joi.object({
            email: commonValidations.email,
            username: commonValidations.username
        }),

        setPasswordAfterOTP: Joi.object({
            email: commonValidations.email,
            username: commonValidations.username,
            password: commonValidations.password
        }),

        login: Joi.object({
            email: commonValidations.email,
            username: commonValidations.username,
            password: commonValidations.password
        }),

        forgotPassword: Joi.object({
            email: commonValidations.email,
            username: commonValidations.username
        }).or('email', 'username')
            .messages({
                'object.missing': 'Provide email or username'
            }),

        verifyForgotPasswordOTP: Joi.object({
            email: commonValidations.emailOptional,
            username: commonValidations.usernameOptional,
            otp: commonValidations.otp
        }).or('email', 'username')
            .messages({
                'object.missing': 'Please provide email or username'
            }),

        resetPasswordWithOTP: Joi.object({
            email: commonValidations.emailOptional,
            username: commonValidations.usernameOptional,
            otp: commonValidations.otp,
            newPassword: commonValidations.password
        }).or('email', 'username')
            .messages({
                'object.missing': 'Provide email or username'
            }),

        resetPassword: Joi.object({
            email: commonValidations.emailOptional,
            username: commonValidations.usernameOptional,
            oldPassword: Joi.string().required(),
            newPassword: commonValidations.password
        }).or('email', 'username')
            .messages({
                'object.missing': 'Please provide email or username'
            }),

        resendForgotPasswordOTP: Joi.object({
            email: commonValidations.emailOptional,
            username: commonValidations.usernameOptional
        }).or('email', 'username')
            .messages({
                'object.missing': 'Please provide either email or username'
            })
    },

    profile: {
        update: Joi.object({
            name: commonValidations.nameOptional,
            phone: commonValidations.phone,
            address: commonValidations.address,
            fatherName: commonValidations.fatherName
        }).unknown(false)
    },

    idParam: commonValidations.idParam,
    sectionParam: commonValidations.sectionParam,
    emailParam: commonValidations.emailParam
};

module.exports = studentValidation;