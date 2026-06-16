const mongoose = require("mongoose");

const FeeComponentSchema = new mongoose.Schema(
    {
        school: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "School",
            required: true,
            index: true,
        },

        name: {
            type: String,
            required: true,
            trim: true,
            maxlength: 100,
        },

        code: {
            type: String,
            required: true,
            uppercase: true,
            trim: true,
            maxlength: 50,
        },

        category: {
            type: String,
            enum: [
                "tuition",
                "transport",
                "library",
                "maintenance",
                "examination",
                "fine",
                "hostel",
                "activity",
                "other",
            ],
            default: "other",
        },

        billingType: {
            type: String,
            enum: [
                "monthly",
                "one_time",
                "annual",
                "manual"
            ],
            default: "monthly"
        },

        // effectiveFrom: {
        //     type: Date,
        //     default: Date.now
        // },

        isCustomizable: {
            type: Boolean,
            default: false,
        },

        defaultAmount: {
            type: Number,
            min: 0,
            default: null,
        },

        isRequired: {
            type: Boolean,
            default: true,
        },

        status: {
            type: String,
            enum: ["active", "inactive"],
            default: "active",
        },

        description: {
            type: String,
            trim: true,
            maxlength: 500,
        },
    },
    {
        timestamps: true,
    }
);

FeeComponentSchema.index({ school: 1, code: 1 }, { unique: true });
FeeComponentSchema.index({ school: 1, status: 1 });

module.exports = mongoose.model("FeeComponent", FeeComponentSchema);