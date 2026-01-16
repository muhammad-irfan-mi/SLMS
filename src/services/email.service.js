
const nodemailer = require('nodemailer');
const School = require('../models/School');

class EmailService {
    constructor() {
        this.transporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST || 'smtp.gmail.com',
            port: process.env.SMTP_PORT || 587,
            secure: process.env.SMTP_SECURE === 'true',
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS,
            },
        });
    }

    async getSchoolName(schoolId) {
        try {
            if (!schoolId) return "School Management System";
            const school = await School.findById(schoolId);
            return school ? school.name : "School Management System";
        } catch (error) {
            return "School Management System";
        }
    }

    // Send OTP email for school verification
    async sendOTPEmail(email, otpCode, schoolName) {
        const mailOptions = {
            from: `"School Management System" <${process.env.EMAIL_USER}>`,
            to: email,
            subject: 'Verify Your School Registration',
            html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">School Registration Verification</h2>
          <p>Dear ${schoolName},</p>
          <p>Thank you for registering your school. Please use the following OTP to verify your email address:</p>
          <div style="background-color: #f4f4f4; padding: 15px; border-radius: 5px; text-align: center; margin: 20px 0;">
            <h1 style="color: #0066cc; letter-spacing: 5px; margin: 0;">${otpCode}</h1>
          </div>
          <p>This OTP is valid for <strong>10 minutes</strong>.</p>
          <p>If you didn't request this registration, please ignore this email.</p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
          <p style="color: #666; font-size: 12px;">This is an automated message, please do not reply.</p>
        </div>
      `,
        };

        try {
            await this.transporter.sendMail(mailOptions);
            console.log(`School OTP email sent to ${email}`);
            return true;
        } catch (error) {
            console.error('Error sending school OTP email:', error);
            throw new Error('Failed to send OTP email');
        }
    }

    // Send password setup email for school
    async sendPasswordSetupEmail(email, schoolName, schoolId) {
        const mailOptions = {
            from: `"School Management System" <${process.env.EMAIL_USER}>`,
            to: email,
            subject: 'Set Your School Account Password',
            html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">Welcome to School Management System</h2>
          <p>Dear ${schoolName},</p>
          <p>Your school registration has been verified successfully!</p>
          <p>Your School ID: <strong>${schoolId}</strong></p>
          <p>Please click the link below to set your password and complete your account setup:</p>
          <div style="text-align: center; margin: 25px 0;">
            <a href="${process.env.FRONTEND_URL}/set-password?email=${encodeURIComponent(email)}&schoolId=${schoolId}" 
               style="background-color: #0066cc; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">
              Set Your Password
            </a>
          </div>
          <p>This link will expire in 24 hours.</p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
          <p style="color: #666; font-size: 12px;">If you didn't request this registration, please contact support.</p>
        </div>
      `,
        };

        try {
            await this.transporter.sendMail(mailOptions);
            console.log(`Password setup email sent to ${email}`);
            return true;
        } catch (error) {
            console.error('Error sending password setup email:', error);
            throw new Error('Failed to send password setup email');
        }
    }

    // Send OTP email for user verification (employee/student)
    async sendUserOTPEmail(email, otpCode, username, schoolId) {
        const schoolName = await this.getSchoolName(schoolId);

        let userSpecificInfo = '';
        if (username) {
            userSpecificInfo = `
                <div style="background-color: #e8f4fd; padding: 15px; border-radius: 8px; margin: 15px 0;">
                    <h3 style="color: #2c3e50; margin: 0 0 10px 0;">Your Login Details:</h3>
                    <p style="margin: 5px 0;"><strong>Username:</strong> ${username}</p>
                    <p style="margin: 5px 0;"><strong>Email:</strong> ${email}</p>
                    <p style="margin: 5px 0; font-size: 12px; color: #666;">Keep this information secure</p>
                </div>
            `;
        }
        const mailOptions = {
            from: `Khaiyal School Managment System\n" ${process.env.EMAIL_USER || process.env.SMTP_USER}`,
            to: email,
            subject: `Verify Your Account - ${schoolName}`,
            html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">Account Verification</h2>
          <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <h3>Account Details:</h3>
          <p><strong>Username:</strong> ${username}</p> 
        </div>
        <p>Please use the following OTP to verify your account:</p>
        <div style="background-color: #f4f4f4; padding: 15px; border-radius: 5px; text-align: center; margin: 20px 0;">
          <h1 style="color: #0066cc; letter-spacing: 5px; margin: 0;">${otpCode}</h1>
        </div>
        <p>This OTP is valid for <strong>10 minutes</strong>.</p>
        <p>After verification, you can set your password in the mobile app.</p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
        <p style="color: #666; font-size: 12px;">This is an automated message, please do not reply.</p>
      </div>
    `,
        };

        try {
            await this.transporter.sendMail(mailOptions);
            console.log(`User OTP email sent to ${email}`);
            return true;
        } catch (error) {
            console.error('Error sending user OTP email:', error);
            throw new Error('Failed to send OTP email');
        }
    }

    // Send forgot password OTP email
    async sendForgotPasswordOTPEmail(email, otpCode, userName) {
        const mailOptions = {
            from: `"School Management System" <${process.env.EMAIL_USER || process.env.SMTP_USER}>`,
            to: email,
            subject: 'Password Reset OTP',
            html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">Password Reset Request</h2>
         <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <h3>Account Details:</h3>
          <p><strong>Username:</strong> ${userName}</p> 
        </div>
        <p>You have requested to reset your password. Use the OTP below to proceed:</p>
        <div style="background-color: #f4f4f4; padding: 15px; border-radius: 5px; text-align: center; margin: 20px 0;">
          <h1 style="color: #0066cc; letter-spacing: 5px; margin: 0;">${otpCode}</h1>
        </div>
        <p>This OTP is valid for <strong>10 minutes</strong>.</p>
        <p>If you didn't request a password reset, please ignore this email.</p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
        <p style="color: #666; font-size: 12px;">This is an automated message, please do not reply.</p>
      </div>
    `,
        };

        try {
            await this.transporter.sendMail(mailOptions);
            console.log(`Forgot password OTP email sent to ${email}`);
            return true;
        } catch (error) {
            console.error('Error sending forgot password OTP email:', error);
            throw new Error('Failed to send OTP email');
        }
    }

    // Send password changed notification
    async sendPasswordChangedNotification(email, userName) {
        const mailOptions = {
            from: `"School Management System" <${process.env.EMAIL_USER || process.env.SMTP_USER}>`,
            to: email,
            subject: 'Password Changed Successfully',
            html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">Password Updated</h2>
        <p>Dear ${userName},</p>
        <p>Your password has been changed successfully.</p>
        <div style="background-color: #d4edda; color: #155724; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <p style="margin: 0;"><strong>✓ Password Updated Successfully</strong></p>
        </div>
        <p>If you didn't make this change, please contact our support team immediately.</p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
        <p style="color: #666; font-size: 12px;">This is an automated message, please do not reply.</p>
      </div>
    `,
        };

        try {
            await this.transporter.sendMail(mailOptions);
            console.log(`Password changed notification sent to ${email}`);
            return true;
        } catch (error) {
            console.error('Error sending password changed notification:', error);
            throw new Error('Failed to send notification email');
        }
    }

    // Send student registration email
    async sendStudentRegistrationEmail(email, otpCode, name, username,schoolId) {
        const schoolName = await this.getSchoolName(schoolId);


        const mailOptions = {
 from: `"${schoolName}" <${process.env.EMAIL_USER || process.env.SMTP_USER}>`,
            to: email,
            subject: `Student Account Created - ${schoolName}`,
            html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">Student Account Created</h2>
        <p>Dear ${name},</p>
        <p>Your student account has been created successfully.</p>
        <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <h3>Account Details:</h3>
          <p><strong>Username:</strong> ${username}</p>
         
        </div>
        <p>Use the OTP below to verify your account:</p>
        <div style="background-color: #f4f4f4; padding: 15px; border-radius: 5px; text-align: center; margin: 20px 0;">
          <h1 style="color: #0066cc; letter-spacing: 5px; margin: 0;">${otpCode}</h1>
        </div>
        <p>This OTP is valid for <strong>10 minutes</strong>.</p>
        <p>After verification, you can set your password and log in.</p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
        <p style="color: #666; font-size: 12px;">Best regards,<br>School Management System</p>
      </div>
    `,
        };

        try {
            await this.transporter.sendMail(mailOptions);
            console.log(`Student registration email sent to ${email}`);
            return true;
        } catch (error) {
            console.error('Error sending student registration email:', error);
            throw new Error('Failed to send registration email');
        }
    }

    // Send welcome email
    async sendWelcomeEmail(email, userName, role, username = null) {
        const mailOptions = {
            from: `"School Management System" <${process.env.EMAIL_USER || process.env.SMTP_USER}>`,
            to: email,
            subject: 'Welcome to School Management System',
            html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">Welcome to School Management System!</h2>
        <p>Dear ${userName},</p>
        <p>Your account has been created successfully.</p>
        <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <h3>Account Details:</h3>
          <p><strong>Role:</strong> ${role}</p>
          ${username ? `<p><strong>Username:</strong> ${username}</p>` : ''}
        </div>
        <p>You can now log in to your account using your credentials.</p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
        <p style="color: #666; font-size: 12px;">Best regards,<br>School Management System</p>
      </div>
    `,
        };

        try {
            await this.transporter.sendMail(mailOptions);
            console.log(`Welcome email sent to ${email}`);
            return true;
        } catch (error) {
            console.error('Error sending welcome email:', error);
            throw new Error('Failed to send welcome email');
        }
    }
}

const emailService = new EmailService();
module.exports = emailService;