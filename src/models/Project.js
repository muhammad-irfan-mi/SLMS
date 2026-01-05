const mongoose = require("mongoose");
const { Schema } = mongoose;

const submissionSchema = new Schema({
  studentId: {
    type: Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  submittedAt: {
    type: Date,
    default: Date.now
  },
  submissionText: {
    type: String,
    maxlength: 5000
  },
  files: {
    images: [String],
    pdf: String
  },
  marks: {
    type: Number,
    min: 0,
    validate: {
      validator: function(value) {
        return value <= this.parent().maxMarks;
      },
      message: "Marks cannot exceed maximum marks"
    }
  },
  feedback: {
    type: String,
    maxlength: 1000
  },
  status: {
    type: String,
    enum: ["pending", "submitted", "graded", "rejected", "resubmit"],
    default: "pending"
  },
  grade: {
    type: String,
    enum: ["A", "B", "C", "D", "F", null],
    default: null
  }
}, { _id: true });

const projectSchema = new Schema({
  school: { 
    type: Schema.Types.ObjectId, 
    ref: "School", 
    required: true 
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
    maxlength: 500
  },
  detail: {
    type: String,
    trim: true,
    maxlength: 2000
  },
  classId: { 
    type: Schema.Types.ObjectId, 
    ref: "ClassSection", 
    required: true 
  },
  sectionId: { 
    type: Schema.Types.ObjectId, 
    ref: "Section", 
    required: true 
  },
  assignedBy: { 
    type: Schema.Types.ObjectId, 
    ref: "User", 
    required: true 
  },
  assignedAt: { 
    type: Date, 
    default: Date.now 
  },
  targetType: { 
    type: String, 
    enum: ["section", "students"], 
    default: "section" 
  },
  subjectId: { 
    type: Schema.Types.ObjectId, 
    ref: "Subject", 
    required: true 
  },
  studentIds: [{ 
    type: Schema.Types.ObjectId, 
    ref: "User" 
  }],
  deadline: { 
    type: Date,
    required: true
  },
  maxMarks: {
    type: Number,
    min: 0,
    max: 1000,
    default: 100
  },
  status: {
    type: String,
    enum: ["draft", "assigned", "completed", "graded"],
    default: "assigned"
  },
  images: [{
    type: String,
    validate: {
      validator: function(images) {
        return images.length <= 5;
      },
      message: "Cannot have more than 5 images"
    }
  }],
  pdf: String,
  
  // Store submissions within the project
  submissions: [submissionSchema],
  
  // Track overall grading status
  gradingCompleted: {
    type: Boolean,
    default: false
  },
  
  // Summary statistics
  submissionStats: {
    totalEligible: { type: Number, default: 0 },
    submitted: { type: Number, default: 0 },
    graded: { type: Number, default: 0 },
    averageMarks: { type: Number, default: 0 }
  }

}, { 
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual for checking if deadline has passed
projectSchema.virtual('isDeadlinePassed').get(function() {
  return this.deadline < new Date();
});

// Virtual for eligible students count
projectSchema.virtual('eligibleStudentsCount').get(function() {
  if (this.targetType === 'section') {
    return this.populated('studentIds') ? this.studentIds.length : 0;
  }
  return this.studentIds.length;
});

// Indexes for better query performance
projectSchema.index({ school: 1, classId: 1, sectionId: 1 });
projectSchema.index({ assignedBy: 1, createdAt: -1 });
projectSchema.index({ school: 1, deadline: 1 });
projectSchema.index({ "submissions.studentId": 1 });
projectSchema.index({ status: 1, deadline: 1 });

// Middleware to update submission stats before save
projectSchema.pre('save', function(next) {
  if (this.submissions && this.submissions.length > 0) {
    const submitted = this.submissions.filter(s => s.status === 'submitted' || s.status === 'graded').length;
    const graded = this.submissions.filter(s => s.status === 'graded').length;
    const totalEligible = this.targetType === 'section' ? 
      (this.populated('studentIds') ? this.studentIds.length : 0) : 
      this.studentIds.length;
    
    // Calculate average marks for graded submissions
    const gradedSubmissions = this.submissions.filter(s => s.status === 'graded' && s.marks);
    const averageMarks = gradedSubmissions.length > 0 ? 
      gradedSubmissions.reduce((sum, s) => sum + s.marks, 0) / gradedSubmissions.length : 0;
    
    this.submissionStats = {
      totalEligible,
      submitted,
      graded,
      averageMarks
    };
    
    // Update overall project status
    if (graded === totalEligible && totalEligible > 0) {
      this.gradingCompleted = true;
      this.status = 'graded';
    } else if (submitted > 0) {
      this.status = 'completed';
    }
  }
  
  next();
});

module.exports = mongoose.model("Project", projectSchema);