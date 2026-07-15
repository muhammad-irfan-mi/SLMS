const mongoose = require('mongoose');
const { Schema } = mongoose;

const cashAccountSchema = new Schema({
    school: {
        type: Schema.Types.ObjectId,
        ref: 'School',
        required: true,
        unique: true, 
        index: true
    },
    title: {
        type: String,
        required: true,
        trim: true,
        default: 'Cash Account'
    },
    description: {
        type: String,
        trim: true
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
cashAccountSchema.index({ school: 1, isActive: 1 });

module.exports = mongoose.model('CashAccount', cashAccountSchema);