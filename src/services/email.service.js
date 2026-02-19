const { Resend } = require('resend');
const School = require('../models/School');

const resend = new Resend(process.env.RESEND_API_KEY);

class EmailService {

  constructor() {
    this.from = `School Management System <noreply@khaiyal.com>`; 
  }

  async sendEmail({ to, subject, html }) {
    try {
      const response = await resend.emails.send({
        from: this.from,
        to,
        subject,
        html
      });

      console.log("Email sent:", response.id);
      return true;

    } catch (error) {
      console.error("Resend error:", error);
      throw new Error("Failed to send email");
    }
  }

  async getSchoolName(schoolId) {
    try {
      if (!schoolId) return "School Management System";
      const school = await School.findById(schoolId);
      return school ? school.name : "School Management System";
    } catch {
      return "School Management System";
    }
  }

  // School OTP
  async sendOTPEmail(email, otpCode, schoolName) {
    return this.sendEmail({
      to: email,
      subject: "Verify Your School Registration",
      html: `
        <h2>School Registration Verification</h2>
        <p>Dear ${schoolName},</p>
        <h1>${otpCode}</h1>
        <p>This OTP is valid for 10 minutes.</p>
      `
    });
  }

  // Password Setup
  async sendPasswordSetupEmail(email, schoolName, schoolId) {
    return this.sendEmail({
      to: email,
      subject: "Set Your School Account Password",
      html: `
        <h2>Welcome ${schoolName}</h2>
        <p>Your School ID: <strong>${schoolId}</strong></p>
        <a href="${process.env.FRONTEND_URL}/set-password?email=${encodeURIComponent(email)}&schoolId=${schoolId}">
          Set Password
        </a>
      `
    });
  }

  // User OTP
  async sendUserOTPEmail(email, otpCode, username, schoolId) {
    const schoolName = await this.getSchoolName(schoolId);

    return this.sendEmail({
      to: email,
      subject: `Verify Your Account - ${schoolName}`,
      html: `
        <h2>Account Verification</h2>
        <p><strong>Username:</strong> ${username}</p>
        <h1>${otpCode}</h1>
        <p>This OTP is valid for 10 minutes.</p>
      `
    });
  }

  // Forgot Password OTP
  async sendForgotPasswordOTPEmail(email, otpCode, userName) {
    return this.sendEmail({
      to: email,
      subject: "Password Reset OTP",
      html: `
        <h2>Password Reset</h2>
        <p>Dear ${userName},</p>
        <h1>${otpCode}</h1>
        <p>This OTP is valid for 10 minutes.</p>
      `
    });
  }

  // Password Changed Notification
  async sendPasswordChangedNotification(email, userName) {
    return this.sendEmail({
      to: email,
      subject: "Password Changed Successfully",
      html: `
        <h2>Password Updated</h2>
        <p>Dear ${userName},</p>
        <p>Your password has been changed successfully.</p>
      `
    });
  }

  // Student Registration
  async sendStudentRegistrationEmail(email, otpCode, name, username, schoolId) {
    const schoolName = await this.getSchoolName(schoolId);

    return this.sendEmail({
      to: email,
      subject: `Student Account Created - ${schoolName}`,
      html: `
        <h2>Student Account Created</h2>
        <p>Dear ${name},</p>
        <p><strong>Username:</strong> ${username}</p>
        <h1>${otpCode}</h1>
        <p>This OTP is valid for 10 minutes.</p>
      `
    });
  }

  // Welcome Email
  async sendWelcomeEmail(email, userName, role, username = null) {
    return this.sendEmail({
      to: email,
      subject: "Welcome to School Management System",
      html: `
        <h2>Welcome ${userName}</h2>
        <p>Role: ${role}</p>
        ${username ? `<p>Username: ${username}</p>` : ''}
      `
    });
  }
}

module.exports = new EmailService();
