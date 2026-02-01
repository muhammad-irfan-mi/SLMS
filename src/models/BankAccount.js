const mongoose = require('mongoose');
const { Schema } = mongoose;

const bankAccountSchema = new Schema({
    school: {
        type: Schema.Types.ObjectId,
        ref: 'School',
        required: true
    },
    accountHolderName: {
        type: String,
        required: true,
        trim: true
    },
    accountNumber: {
        type: String,
        required: true,
        trim: true
    },
    bankName: {
        type: String,
        required: true,
        trim: true
    },
    branchName: {
        type: String,
        trim: true
    },
    accountType: {
        type: String,
        enum: ['saving', 'current', 'salary'],
        default: 'saving'
    },
    ifscCode: {
        type: String,
        required: true,
        trim: true,
        uppercase: true
    },
    isActive: {
        type: Boolean,
        default: true
    },
    createdBy: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    updatedBy: {
        type: Schema.Types.ObjectId,
        ref: 'User'
    }
}, {
    timestamps: true
});

bankAccountSchema.index({ school: 1, accountNumber: 1 }, { unique: true });
bankAccountSchema.index({ school: 1, isActive: 1 });

module.exports = mongoose.model('BankAccount', bankAccountSchema);