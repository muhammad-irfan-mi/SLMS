const mongoose = require("mongoose");

const ExpenseSchema = new mongoose.Schema(
    {
        school: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "School",
            required: true,
            index: true
        },
        title: {
            type: String,
            required: true,
            trim: true,
            maxlength: 200
        },
        description: {
            type: String,
            trim: true,
            maxlength: 1000
        },
        category: {
            type: String,
            required: true,
            enum: [
                'salary', 'utilities', 'maintenance', 'supplies', 'equipment',
                'marketing', 'transport', 'food', 'events', 'insurance',
                'taxes', 'rent', 'professional_services', 'technology',
                'training', 'other'
            ],
            index: true
        },
        amount: {
            type: Number,
            required: true,
            min: 0
        },
        date: {
            type: Date,
            required: true,
            default: Date.now,
            index: true
        },
        paymentMethod: {
            type: String,
            enum: ['cash', 'bank'],
            default: 'cash'
        },
        bankAccountId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "BankAccount",
            default: null
        },
        receipt: { type: String },
        status: {
            type: String,
            enum: ['pending', 'approved', 'paid', 'cancelled'],
            default: 'pending'
        },
        approvedAt: Date
    },
    { timestamps: true }
);

// Indexes for performance
ExpenseSchema.index({ school: 1, date: -1 });
ExpenseSchema.index({ school: 1, category: 1, date: -1 });
ExpenseSchema.index({ school: 1, status: 1, date: -1 });
ExpenseSchema.index({ school: 1, createdBy: 1 });
ExpenseSchema.index({ bankAccountId: 1 });

// Virtuals
ExpenseSchema.virtual('year').get(function () {
    return this.date.getFullYear();
});

ExpenseSchema.virtual('month').get(function () {
    return this.date.getMonth() + 1;
});

ExpenseSchema.virtual('day').get(function () {
    return this.date.getDate();
});

module.exports = mongoose.model("Expense", ExpenseSchema);