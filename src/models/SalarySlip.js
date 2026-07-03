const mongoose = require("mongoose");

const PaymentHistorySchema = new mongoose.Schema({
    amount: { type: Number, required: true },
    paymentMethod: {
        type: String,
        enum: ['cash', 'bank'],
        required: true
    },
    bankAccountId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "BankAccount",
        default: null
    },
    paidAt: { type: Date, default: Date.now },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: "Staff" },
    approvedByName: { type: String },
    remarks: { type: String }
});

const SalarySlipSchema = new mongoose.Schema(
    {
        teacherId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Staff",
            required: true,
        },
        school: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "School",
            required: true,
        },
        monthYear: { type: String, required: true }, // Format: YYYY-MM
        title: { type: String, required: true },
        description: { type: String },
        totalAmount: { type: Number, required: true },
        paidAmount: { type: Number, default: 0 },
        remainingAmount: { type: Number, required: true },
        status: {
            type: String,
            enum: ["pending", "partial", "paid"],
            default: "pending",
        },
        paymentHistory: [PaymentHistorySchema],
        documentImage: { type: String },
        expenseId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Expense",
            default: null
        },
        parentSlipId: { type: mongoose.Schema.Types.ObjectId, ref: "SalarySlip" }
    },
    { timestamps: true }
);

SalarySlipSchema.index({ school: 1, teacherId: 1, monthYear: 1 });
SalarySlipSchema.index({ school: 1, status: 1 });
SalarySlipSchema.index({ teacherId: 1, status: 1 });

module.exports = mongoose.model("SalarySlip", SalarySlipSchema);