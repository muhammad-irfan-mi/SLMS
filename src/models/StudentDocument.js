const mongoose = require("mongoose");

const DocumentRequestSchema = new mongoose.Schema(
  {
    requestedBy: {
      type: mongoose.Schema.Types.ObjectId,
      refPath: 'requestedByModel',
      required: true
    },
    requestedByModel: {
      type: String,
      enum: ["User", "School"],
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
      ref: "ClassSection",
      required: true
    },
    title: {
      type: String,
      required: true,
      maxlength: 200
    },
    description: {
      type: String,
      required: true,
      maxlength: 1000
    },
    requestType: {
      type: String,
      enum: ["document", "question", "data"],
      default: "document"
    },
    documentType: {
      type: String,
      enum: ["assignment", "homework", "certificate", "form", "report", "other"],
      default: "other"
    },
    dueDate: {
      type: Date
    },
    status: {
      type: String,
      enum: ["pending", "uploaded", "reviewed", "approved", "rejected", "expired"],
      default: "pending"
    },
    uploadedDocument: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "StudentDocument",
      default: null
    },
    uploadedAt: {
      type: Date,
      default: null
    },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null
    },
    reviewedAt: {
      type: Date,
      default: null
    },
    reviewComments: {
      type: String,
      maxlength: 500
    }
  },
  { 
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Student Document Model
const StudentDocumentSchema = new mongoose.Schema(
  {
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    classId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ClassSection",
      required: true,
    },
    sectionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ClassSection",
      required: true,
    },
    text: { 
      type: String,
      maxlength: 2000
    },
    files: [{ 
      type: String,
      validate: {
        validator: function(v) {
          return /^https?:\/\//.test(v);
        },
        message: props => `${props.value} is not a valid URL!`
      }
    }],
    uploadedFor: {
      type: String,
      enum: ["teacher", "admin_office", "school"],
      default: "admin_office",
    },
    requestedBy: {
      type: mongoose.Schema.Types.ObjectId,
      refPath: 'requestedByModel',
      default: null
    },
    requestedByModel: {
      type: String,
      enum: ["User", "School"],
      default: null
    },
    requestType: {
      type: String,
      enum: ["document", "question", "data"],
      default: null
    },
    requestDetails: {
      type: String,
      maxlength: 1000
    },
    status: {
      type: String,
      enum: ["pending", "submitted", "reviewed", "approved", "rejected"],
      default: "submitted"
    },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null
    },
    reviewedAt: {
      type: Date,
      default: null
    },
    reviewComments: {
      type: String,
      maxlength: 500
    }
  },
  { 
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Indexes for DocumentRequest
DocumentRequestSchema.index({ studentId: 1, status: 1 });
DocumentRequestSchema.index({ requestedBy: 1 });
DocumentRequestSchema.index({ classId: 1, sectionId: 1 });
DocumentRequestSchema.index({ dueDate: 1 });
DocumentRequestSchema.index({ status: 1 });

// Indexes for StudentDocument
StudentDocumentSchema.index({ studentId: 1, createdAt: -1 });
StudentDocumentSchema.index({ classId: 1, sectionId: 1 });
StudentDocumentSchema.index({ uploadedFor: 1 });
StudentDocumentSchema.index({ requestedBy: 1 });
StudentDocumentSchema.index({ status: 1 });

// Virtual for populated requestedBy in DocumentRequest
DocumentRequestSchema.virtual('requesterInfo', {
  ref: doc => doc.requestedByModel,
  localField: 'requestedBy',
  foreignField: '_id',
  justOne: true
});

// Virtual for populated requestedBy in StudentDocument
StudentDocumentSchema.virtual('requestedByInfo', {
  ref: doc => doc.requestedByModel || 'User',
  localField: 'requestedBy',
  foreignField: '_id',
  justOne: true
});

// Middleware to check due date in DocumentRequest
DocumentRequestSchema.pre('save', function(next) {
  if (this.dueDate && this.dueDate < new Date() && this.status === 'pending') {
    this.status = 'expired';
  }
  next();
});

const DocumentRequest = mongoose.model("DocumentRequest", DocumentRequestSchema);
const StudentDocument = mongoose.model("StudentDocument", StudentDocumentSchema);

module.exports = {
  DocumentRequest,
  StudentDocument
};