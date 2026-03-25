const mongoose = require("mongoose");
const { baseUserSchema } = require("./BaseUser");

const StaffSchema = new mongoose.Schema({
    ...baseUserSchema,
    role: {
        type: String,
        enum: ["superadmin", "admin_office", "teacher"],
        required: true,
    },
    salary: Number,
    joiningDate: Date,
    isIncharge: { type: Boolean, default: false },
    classInfo: {
        id: { type: mongoose.Schema.Types.ObjectId, ref: "ClassSection" },
    },
    sectionInfo: {
        id: { type: mongoose.Schema.Types.ObjectId },
    },
    deviceLocation: {
        lat: Number,
        lng: Number,
    },
    employeeId: {
        type: String,
        unique: true,
        sparse: true
    }
}, {
    timestamps: true,
    collection: 'staff'
});

StaffSchema.index({ email: 1, school: 1 }, { unique: true });
StaffSchema.index({ school: 1, role: 1 });
StaffSchema.index({ "otp.expiresAt": 1 }, {
    expireAfterSeconds: 0,
    partialFilterExpression: { "otp.expiresAt": { $exists: true }, verified: false }
});
StaffSchema.index(
    { createdAt: 1 },
    { expireAfterSeconds: 7 * 24 * 60 * 60, partialFilterExpression: { verified: false } }
);

module.exports = mongoose.model("Staff", StaffSchema);