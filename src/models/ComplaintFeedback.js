const mongoose = require("mongoose");

const ReviewSchema = new mongoose.Schema({
    reviewerId: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: "User", 
        required: true 
    },
    reviewerRole: { 
        type: String, 
        enum: ["admin", "user"], 
        required: true 
    },
    comment: { 
        type: String, 
        required: true 
    },
    action: { 
        type: String,
        default: "" 
    },
    reviewedAt: { 
        type: Date, 
        default: Date.now 
    }
});

const ComplaintFeedbackSchema = new mongoose.Schema(
    {
        school: { 
            type: mongoose.Schema.Types.ObjectId, 
            ref: "School", 
            required: true 
        },
        studentId: { 
            type: mongoose.Schema.Types.ObjectId, 
            ref: "User", 
            required: true 
        },
        classId: { 
            type: mongoose.Schema.Types.ObjectId, 
            ref: "ClassSection", 
            required: true 
        },
        sectionId: { 
            type: mongoose.Schema.Types.ObjectId, 
            required: true 
        },
        type: { 
            type: String, 
            enum: ["complaint", "feedback"], 
            required: true 
        },
        title: { 
            type: String, 
            required: true,
            trim: true 
        },
        detail: { 
            type: String, 
            required: true,
            trim: true 
        },
        status: {
            type: String,
            enum: ["pending", "reviewed", "resolved", "submitted", "addressed"],
            default: "pending"
        },
        reviews: [ReviewSchema],
        createdBy: { 
            type: mongoose.Schema.Types.ObjectId, 
            ref: "User",
            required: true 
        },
        autoDeleteAt: {
            type: Date,
            required: true,
            default: function() {
                // Set auto-delete time based on type
                const deleteDate = new Date();
                if (this.type === "complaint") {
                    // Complaints auto-delete after 30 days regardless of status
                    deleteDate.setDate(deleteDate.getDate() + 30);
                } else {
                    // Feedback auto-delete after 90 days
                    deleteDate.setDate(deleteDate.getDate() + 90);
                }
                return deleteDate;
            }
        }
    },
    { 
        timestamps: true,
        toJSON: { virtuals: true },
        toObject: { virtuals: true }
    }
);

// Index for auto-delete queries
ComplaintFeedbackSchema.index({ autoDeleteAt: 1 });
ComplaintFeedbackSchema.index({ school: 1, status: 1 });
ComplaintFeedbackSchema.index({ studentId: 1, createdAt: -1 });
ComplaintFeedbackSchema.index({ type: 1 });

// Virtual for days remaining before auto-delete
ComplaintFeedbackSchema.virtual('daysUntilAutoDelete').get(function() {
    const now = new Date();
    const deleteDate = this.autoDeleteAt;
    const diffTime = deleteDate - now;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    return Math.max(0, diffDays);
});

// Virtual for isExpired (just for display)
ComplaintFeedbackSchema.virtual('isExpired').get(function() {
    const now = new Date();
    return now > this.autoDeleteAt;
});

module.exports = mongoose.model("ComplaintFeedback", ComplaintFeedbackSchema);