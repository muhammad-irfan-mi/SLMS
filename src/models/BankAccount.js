const mongoose = require('mongoose');
const { Schema } = mongoose;

const bankAccountSchema = new Schema({
    school: {
        type: Schema.Types.ObjectId,
        ref: 'School',
        required: true,
        index: true
    },
    accountNumber: {
        type: String,
        required: true,
        trim: true,
        index: true
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
    iban: {
        type: String,
        trim: true,
        uppercase: true
    },
    amount: {
        type: Number,
        default: 0,
        min: 0
    },
    isActive: {
        type: Boolean,
        default: true,
        index: true
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

// Indexes
bankAccountSchema.index({ school: 1, accountNumber: 1 }, { unique: true });
bankAccountSchema.index({ school: 1, isActive: 1 });

module.exports = mongoose.model('BankAccount', bankAccountSchema);