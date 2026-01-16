
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

// Create and export a singleton instance
const emailService = new EmailService();
module.exports = emailService;





















// const nodemailer = require('nodemailer');
// const School = require("../models/School"); // Add this import

// class EmailService {
//     constructor() {
//         this.transporter = nodemailer.createTransport({
//             host: process.env.SMTP_HOST || 'smtp.gmail.com',
//             port: process.env.SMTP_PORT || 587,
//             secure: process.env.SMTP_SECURE === 'true',
//             auth: {
//                 user: process.env.EMAIL_USER,
//                 pass: process.env.EMAIL_PASS,
//             },
//         });
//     }

//     // Helper function to get school name
//     async getSchoolName(schoolId) {
//         try {
//             if (!schoolId) return "School Management System";
//             const school = await School.findById(schoolId);
//             return school ? school.name : "School Management System";
//         } catch (error) {
//             console.error('Error fetching school name:', error);
//             return "School Management System";
//         }
//     }

//     // Send OTP email for user verification (employee/student) - UPDATED
//     async sendUserOTPEmail(email, otpCode, userName, schoolId, username = null, userRole = 'user') {
//         const schoolName = await this.getSchoolName(schoolId);

//         let userSpecificInfo = '';
//         if (userRole === 'student' && username) {
//             userSpecificInfo = `
//                 <div style="background-color: #e8f4fd; padding: 15px; border-radius: 8px; margin: 15px 0;">
//                     <h3 style="color: #2c3e50; margin: 0 0 10px 0;">Your Login Details:</h3>
//                     <p style="margin: 5px 0;"><strong>Username:</strong> ${username}</p>
//                     <p style="margin: 5px 0;"><strong>Email:</strong> ${email}</p>
//                     <p style="margin: 5px 0; font-size: 12px; color: #666;">Keep this information secure</p>
//                 </div>
//             `;
//         }

//         const mailOptions = {
//             from: `"${schoolName}" <${process.env.EMAIL_USER || process.env.SMTP_USER}>`,
//             to: email,
//             subject: `Account Verification - ${schoolName}`,
//             html: `
//                 <!DOCTYPE html>
//                 <html>
//                 <head>
//                     <meta charset="UTF-8">
//                     <meta name="viewport" content="width=device-width, initial-scale=1.0">
//                     <title>Account Verification</title>
//                     <style>
//                         body {
//                             font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
//                             line-height: 1.6;
//                             color: #333;
//                             max-width: 600px;
//                             margin: 0 auto;
//                             background-color: #f9f9f9;
//                         }
//                         .container {
//                             background-color: #ffffff;
//                             border-radius: 12px;
//                             padding: 30px;
//                             margin: 20px auto;
//                             box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);
//                         }
//                         .header {
//                             text-align: center;
//                             padding-bottom: 20px;
//                             border-bottom: 2px solid #4CAF50;
//                         }
//                         .school-name {
//                             color: #2c3e50;
//                             font-size: 24px;
//                             font-weight: bold;
//                             margin: 0;
//                         }
//                         .otp-container {
//                             background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
//                             color: white;
//                             padding: 25px;
//                             border-radius: 10px;
//                             text-align: center;
//                             margin: 25px 0;
//                             box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
//                         }
//                         .otp-code {
//                             font-size: 36px;
//                             letter-spacing: 8px;
//                             font-weight: bold;
//                             margin: 15px 0;
//                             font-family: 'Courier New', monospace;
//                         }
//                         .info-box {
//                             background-color: #f8f9fa;
//                             border-left: 4px solid #4CAF50;
//                             padding: 15px;
//                             margin: 20px 0;
//                             border-radius: 4px;
//                         }
//                         .resend-button {
//                             display: inline-block;
//                             background-color: #2196F3;
//                             color: white;
//                             padding: 12px 30px;
//                             text-decoration: none;
//                             border-radius: 25px;
//                             font-weight: bold;
//                             margin-top: 15px;
//                             transition: background-color 0.3s;
//                         }
//                         .resend-button:hover {
//                             background-color: #1976D2;
//                         }
//                         .footer {
//                             text-align: center;
//                             margin-top: 30px;
//                             padding-top: 20px;
//                             border-top: 1px solid #eee;
//                             color: #666;
//                             font-size: 12px;
//                         }
//                         .logo {
//                             max-width: 150px;
//                             margin-bottom: 15px;
//                         }
//                         .note {
//                             background-color: #fff8e1;
//                             border: 1px solid #ffd54f;
//                             border-radius: 6px;
//                             padding: 12px;
//                             margin: 15px 0;
//                             font-size: 14px;
//                         }
//                         .timer {
//                             color: #e74c3c;
//                             font-weight: bold;
//                             font-size: 14px;
//                         }
//                     </style>
//                 </head>
//                 <body>
//                     <div class="container">
//                         <div class="header">
//                             <div class="school-name">${schoolName}</div>
//                             <p style="color: #666; margin-top: 5px;">Account Verification</p>
//                         </div>
                        
//                         <p>Dear <strong>${userName}</strong>,</p>
                        
//                         <p>Welcome to <strong>${schoolName}</strong>! Please verify your account to get started.</p>
                        
//                         ${userSpecificInfo}
                        
//                         <div class="otp-container">
//                             <h3 style="margin-top: 0; color: white;">Your Verification Code</h3>
//                             <div class="otp-code">${otpCode}</div>
//                             <p style="color: rgba(255, 255, 255, 0.9); margin-bottom: 0;">This code will expire in <span class="timer">10 minutes</span></p>
//                         </div>
                        
//                         <div class="info-box">
//                             <strong>📝 How to use this OTP:</strong>
//                             <ul style="margin: 10px 0; padding-left: 20px;">
//                                 <li>Enter this 6-digit code in the verification screen</li>
//                                 <li>After verification, you can set your password</li>
//                                 <li>Keep this code confidential</li>
//                             </ul>
//                         </div>
                        
//                         <div class="note">
//                             <strong>⚠️ Didn't receive the code?</strong>
//                             <p>You can request a new verification code by clicking the button below:</p>
//                             <div style="text-align: center;">
//                                 <a href="mailto:${process.env.SUPPORT_EMAIL || process.env.EMAIL_USER}?subject=Resend%20OTP%20Request&body=Please%20resend%20the%20verification%20OTP%20for%20${encodeURIComponent(email)}" 
//                                    class="resend-button">
//                                    🔄 Resend Verification Code
//                                 </a>
//                             </div>
//                             <p style="margin-top: 10px; font-size: 12px;">Or reply to this email with "RESEND OTP"</p>
//                         </div>
                        
//                         <div class="footer">
//                             <p>This email was sent by ${schoolName} as part of your account verification process.</p>
//                             <p>If you didn't request this verification, please ignore this email.</p>
//                             <p>For assistance, contact: ${process.env.SUPPORT_EMAIL || process.env.EMAIL_USER}</p>
//                             <p style="margin-top: 20px; font-size: 10px; color: #999;">
//                                 © ${new Date().getFullYear()} ${schoolName}. All rights reserved.
//                             </p>
//                         </div>
//                     </div>
//                 </body>
//                 </html>
//             `,
//         };

//         try {
//             await this.transporter.sendMail(mailOptions);
//             console.log(`User OTP email sent to ${email} from ${schoolName}`);
//             return true;
//         } catch (error) {
//             console.error('Error sending user OTP email:', error);
//             throw new Error('Failed to send OTP email');
//         }
//     }

//     // Send forgot password OTP email - UPDATED
//     async sendForgotPasswordOTPEmail(email, otpCode, userName, schoolId) {
//         const schoolName = await this.getSchoolName(schoolId);

//         const mailOptions = {
//             from: `"${schoolName}" <${process.env.EMAIL_USER || process.env.SMTP_USER}>`,
//             to: email,
//             subject: `Password Reset Request - ${schoolName}`,
//             html: `
//                 <!DOCTYPE html>
//                 <html>
//                 <head>
//                     <meta charset="UTF-8">
//                     <meta name="viewport" content="width=device-width, initial-scale=1.0">
//                     <title>Password Reset</title>
//                     <style>
//                         body {
//                             font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
//                             line-height: 1.6;
//                             color: #333;
//                             max-width: 600px;
//                             margin: 0 auto;
//                             background-color: #f9f9f9;
//                         }
//                         .container {
//                             background-color: #ffffff;
//                             border-radius: 12px;
//                             padding: 30px;
//                             margin: 20px auto;
//                             box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);
//                         }
//                         .header {
//                             text-align: center;
//                             padding-bottom: 20px;
//                             border-bottom: 2px solid #e74c3c;
//                         }
//                         .school-name {
//                             color: #2c3e50;
//                             font-size: 24px;
//                             font-weight: bold;
//                             margin: 0;
//                         }
//                         .otp-container {
//                             background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
//                             color: white;
//                             padding: 25px;
//                             border-radius: 10px;
//                             text-align: center;
//                             margin: 25px 0;
//                             box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
//                         }
//                         .otp-code {
//                             font-size: 36px;
//                             letter-spacing: 8px;
//                             font-weight: bold;
//                             margin: 15px 0;
//                             font-family: 'Courier New', monospace;
//                         }
//                         .resend-button {
//                             display: inline-block;
//                             background-color: #3498db;
//                             color: white;
//                             padding: 12px 30px;
//                             text-decoration: none;
//                             border-radius: 25px;
//                             font-weight: bold;
//                             margin-top: 15px;
//                             transition: background-color 0.3s;
//                         }
//                         .resend-button:hover {
//                             background-color: #2980b9;
//                         }
//                         .security-note {
//                             background-color: #ffebee;
//                             border: 1px solid #ef5350;
//                             border-radius: 6px;
//                             padding: 12px;
//                             margin: 15px 0;
//                             font-size: 14px;
//                         }
//                         .footer {
//                             text-align: center;
//                             margin-top: 30px;
//                             padding-top: 20px;
//                             border-top: 1px solid #eee;
//                             color: #666;
//                             font-size: 12px;
//                         }
//                     </style>
//                 </head>
//                 <body>
//                     <div class="container">
//                         <div class="header">
//                             <div class="school-name">${schoolName}</div>
//                             <p style="color: #666; margin-top: 5px;">Password Reset Request</p>
//                         </div>
                        
//                         <p>Dear <strong>${userName}</strong>,</p>
                        
//                         <p>We received a request to reset your password for your account at <strong>${schoolName}</strong>.</p>
                        
//                         <div class="otp-container">
//                             <h3 style="margin-top: 0; color: white;">Reset Password Code</h3>
//                             <div class="otp-code">${otpCode}</div>
//                             <p style="color: rgba(255, 255, 255, 0.9); margin-bottom: 0;">Valid for <strong>10 minutes</strong></p>
//                         </div>
                        
//                         <div class="security-note">
//                             <strong>🔒 Security Notice:</strong>
//                             <p>If you didn't request a password reset, please ignore this email and ensure your account is secure.</p>
//                         </div>
                        
//                         <div style="text-align: center; margin: 25px 0;">
//                             <p>Need a new code?</p>
//                             <a href="mailto:${process.env.SUPPORT_EMAIL || process.env.EMAIL_USER}?subject=Resend%20Password%20Reset%20OTP&body=Please%20resend%20the%20password%20reset%20OTP%20for%20${encodeURIComponent(email)}" 
//                                class="resend-button">
//                                🔄 Request New Reset Code
//                             </a>
//                         </div>
                        
//                         <div class="footer">
//                             <p>This is an automated message from ${schoolName} security system.</p>
//                             <p>© ${new Date().getFullYear()} ${schoolName}</p>
//                         </div>
//                     </div>
//                 </body>
//                 </html>
//             `,
//         };

//         try {
//             await this.transporter.sendMail(mailOptions);
//             console.log(`Forgot password OTP email sent to ${email} from ${schoolName}`);
//             return true;
//         } catch (error) {
//             console.error('Error sending forgot password OTP email:', error);
//             throw new Error('Failed to send OTP email');
//         }
//     }

//     // Send password changed notification - UPDATED
//     async sendPasswordChangedNotification(email, userName, schoolId) {
//         const schoolName = await this.getSchoolName(schoolId);

//         const mailOptions = {
//             from: `"${schoolName}" <${process.env.EMAIL_USER || process.env.SMTP_USER}>`,
//             to: email,
//             subject: `Password Updated Successfully - ${schoolName}`,
//             html: `
//                 <!DOCTYPE html>
//                 <html>
//                 <head>
//                     <meta charset="UTF-8">
//                     <meta name="viewport" content="width=device-width, initial-scale=1.0">
//                     <title>Password Updated</title>
//                     <style>
//                         body {
//                             font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
//                             line-height: 1.6;
//                             color: #333;
//                             max-width: 600px;
//                             margin: 0 auto;
//                             background-color: #f9f9f9;
//                         }
//                         .container {
//                             background-color: #ffffff;
//                             border-radius: 12px;
//                             padding: 30px;
//                             margin: 20px auto;
//                             box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);
//                         }
//                         .success-box {
//                             background: linear-gradient(135deg, #4CAF50 0%, #2E7D32 100%);
//                             color: white;
//                             padding: 25px;
//                             border-radius: 10px;
//                             text-align: center;
//                             margin: 25px 0;
//                         }
//                         .security-tips {
//                             background-color: #f8f9fa;
//                             border-left: 4px solid #3498db;
//                             padding: 15px;
//                             margin: 20px 0;
//                             border-radius: 4px;
//                         }
//                         .footer {
//                             text-align: center;
//                             margin-top: 30px;
//                             padding-top: 20px;
//                             border-top: 1px solid #eee;
//                             color: #666;
//                             font-size: 12px;
//                         }
//                     </style>
//                 </head>
//                 <body>
//                     <div class="container">
//                         <div style="text-align: center;">
//                             <h2 style="color: #2c3e50;">${schoolName}</h2>
//                             <p style="color: #666;">Account Security Notification</p>
//                         </div>
                        
//                         <p>Dear <strong>${userName}</strong>,</p>
                        
//                         <div class="success-box">
//                             <h3 style="margin-top: 0;">✅ Password Updated Successfully</h3>
//                             <p>Your password has been changed for your account at <strong>${schoolName}</strong>.</p>
//                         </div>
                        
//                         <div class="security-tips">
//                             <strong>🔐 Security Tips:</strong>
//                             <ul style="margin: 10px 0; padding-left: 20px;">
//                                 <li>Use a strong, unique password</li>
//                                 <li>Don't share your password with anyone</li>
//                                 <li>Regularly update your password</li>
//                                 <li>Enable two-factor authentication if available</li>
//                             </ul>
//                         </div>
                        
//                         <p><strong>⚠️ Important:</strong> If you didn't make this change, please contact our support team immediately at <a href="mailto:${process.env.SUPPORT_EMAIL || process.env.EMAIL_USER}">${process.env.SUPPORT_EMAIL || process.env.EMAIL_USER}</a></p>
                        
//                         <div class="footer">
//                             <p>This is an automated security notification from ${schoolName}.</p>
//                             <p>© ${new Date().getFullYear()} ${schoolName}. All rights reserved.</p>
//                         </div>
//                     </div>
//                 </body>
//                 </html>
//             `,
//         };

//         try {
//             await this.transporter.sendMail(mailOptions);
//             console.log(`Password changed notification sent to ${email} from ${schoolName}`);
//             return true;
//         } catch (error) {
//             console.error('Error sending password changed notification:', error);
//             throw new Error('Failed to send notification email');
//         }
//     }

//     // Send student registration email - UPDATED
//     async sendStudentRegistrationEmail(email, otpCode, name, finalUsername, className, sectionName, schoolId) {
//         const schoolName = await this.getSchoolName(schoolId);

//         const mailOptions = {
//             from: `"${schoolName}" <${process.env.EMAIL_USER || process.env.SMTP_USER}>`,
//             to: email,
//             subject: `Student Account Created - ${schoolName}`,
//             html: `
//                 <!DOCTYPE html>
//                 <html>
//                 <head>
//                     <meta charset="UTF-8">
//                     <meta name="viewport" content="width=device-width, initial-scale=1.0">
//                     <title>Student Account Created</title>
                  
//                 </head>
//                 <body>
//                     <div class="container">
//                         <div class="welcome-banner">
//                             <h2 style="margin: 0;">Welcome to ${schoolName}!</h2>
//                             <p style="margin: 10px 0 0 0;">Student Account Created</p>
//                         </div>
                        
//                         <p>Dear <strong>${name}</strong>,</p>
                        
//                         <p>We're excited to welcome you to <strong>${schoolName}</strong>! Your student account has been successfully created.</p>
                        
//                         <div class="details-box">
//                             <h3 style="color: #2c3e50; margin-top: 0;">Your Account Details</h3>
//                             <p><strong>Username:</strong> ${finalUsername}</p>
//                             <p><strong>Email:</strong> ${email}</p>
//                         </div>
                        
//                         <div class="otp-box">
//                             <h3 style="color: #2c3e50; margin-top: 0;">Verification Code</h3>
//                             <div style="font-size: 32px; letter-spacing: 8px; font-weight: bold; font-family: 'Courier New', monospace; margin: 15px 0;">
//                                 ${otpCode}
//                             </div>
//                             <p>Enter this code in the verification screen to activate your account.</p>
//                             <p style="font-size: 14px; color: #666;">Valid for 10 minutes</p>
//                         </div>
                        
//                        <div style="text-align:center; margin:25px 0;">
//   <p>Need a new verification code?</p>

//   <form
//     action="${process.env.BASE_URL}/api/empStudent/resend-otp"
//     method="POST"
//     style="display:inline;"
//   >
//     <input type="hidden" name="email" value="${email}" />
//     <input type="hidden" name="username" value="${finalUsername}" />

//     <button
//       type="submit"
//       style="
//         padding:12px 22px;
//         background:#1976d2;
//         color:#ffffff;
//         border:none;
//         border-radius:6px;
//         font-size:16px;
//         cursor:pointer;
//       "
//     >
//       Resend Verification Code
//     </button>
//   </form>
// </div>

                        
//                         <div style="background-color: #e3f2fd; padding: 15px; border-radius: 8px;">
//                             <strong>Next Steps:</strong>
//                             <ol style="margin: 10px 0; padding-left: 20px;">
//                                 <li>Verify your account using the code above</li>
//                                 <li>Set up your password</li>
//                                 <li>Log in to your student portal</li>
//                                 <li>Download the school app for mobile access</li>
//                             </ol>
//                         </div>
                        
//                         <div class="footer">
//                             <p>Best regards,<br>The ${schoolName} Team</p>
//                             <p>Contact us: ${process.env.SUPPORT_EMAIL || process.env.EMAIL_USER}</p>
//                             <p>© ${new Date().getFullYear()} ${schoolName}. All rights reserved.</p>
//                         </div>
//                     </div>
//                 </body>
//                 </html>
//             `,
//         };

//         try {
//             await this.transporter.sendMail(mailOptions);
//             console.log(`Student registration email sent to ${email} from ${schoolName}`);
//             return true;
//         } catch (error) {
//             console.error('Error sending student registration email:', error);
//             throw new Error('Failed to send registration email');
//         }
//     }

//     // Other existing methods (sendOTPEmail, sendPasswordSetupEmail, sendWelcomeEmail) remain the same
//     // but you can update them similarly with school name if needed

//     // Send OTP email for school verification - UPDATED with school name
//     async sendOTPEmail(email, otpCode, schoolName) {
//         const mailOptions = {
//             from: `"${schoolName}" <${process.env.EMAIL_USER}>`,
//             to: email,
//             subject: `Verify Your School Registration - ${schoolName}`,
//             html: `
//                 <!DOCTYPE html>
//                 <html>
//                 <head>
//                     <meta charset="UTF-8">
//                     <style>
//                         body { font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; }
//                         .header { background-color: #4CAF50; color: white; padding: 20px; text-align: center; }
//                         .otp-box { background-color: #f4f4f4; padding: 20px; text-align: center; margin: 20px 0; border-radius: 10px; }
//                         .otp { font-size: 32px; letter-spacing: 5px; color: #0066cc; font-weight: bold; }
//                         .footer { text-align: center; margin-top: 30px; color: #666; font-size: 12px; }
//                         .resend-btn { 
//                             display: inline-block; 
//                             background-color: #2196F3; 
//                             color: white; 
//                             padding: 10px 20px; 
//                             text-decoration: none; 
//                             border-radius: 5px; 
//                             margin-top: 15px; 
//                         }
//                     </style>
//                 </head>
//                 <body>
//                     <div class="header">
//                         <h2>${schoolName}</h2>
//                         <p>School Registration Verification</p>
//                     </div>
                    
//                     <p>Dear ${schoolName},</p>
                    
//                     <div class="otp-box">
//                         <p>Your verification code:</p>
//                         <div class="otp">${otpCode}</div>
//                         <p>Valid for 10 minutes</p>
//                     </div>
                    
//                     <div style="text-align: center;">
//                         <p>Need a new code?</p>
//                         <a href="mailto:${process.env.SUPPORT_EMAIL || process.env.EMAIL_USER}?subject=Resend%20School%20OTP&body=Please%20resend%20verification%20OTP%20for%20${encodeURIComponent(schoolName)}" 
//                            class="resend-btn">
//                            🔄 Resend Code
//                         </a>
//                     </div>
                    
//                     <div class="footer">
//                         <p>This email was sent by ${schoolName}</p>
//                     </div>
//                 </body>
//                 </html>
//             `,
//         };

//         try {
//             await this.transporter.sendMail(mailOptions);
//             console.log(`School OTP email sent to ${email}`);
//             return true;
//         } catch (error) {
//             console.error('Error sending school OTP email:', error);
//             throw new Error('Failed to send OTP email');
//         }
//     }

//     // Send welcome email - UPDATED
//     async sendWelcomeEmail(email, userName, role, schoolId, username = null) {
//         const schoolName = await this.getSchoolName(schoolId);

//         const mailOptions = {
//             from: `"${schoolName}" <${process.env.EMAIL_USER || process.env.SMTP_USER}>`,
//             to: email,
//             subject: `Welcome to ${schoolName}!`,
//             html: `
//                 <!DOCTYPE html>
//                 <html>
//                 <head>
//                     <meta charset="UTF-8">
//                     <style>
//                         body { font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; }
//                         .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; }
//                         .welcome-box { background-color: #e8f5e8; padding: 20px; border-radius: 10px; margin: 20px 0; }
//                         .details-box { background-color: #f8f9fa; padding: 15px; border-radius: 8px; margin: 20px 0; }
//                         .footer { text-align: center; margin-top: 30px; color: #666; font-size: 12px; }
//                     </style>
//                 </head>
//                 <body>
//                     <div class="header">
//                         <h1>Welcome to ${schoolName}!</h1>
//                     </div>
                    
//                     <p>Dear <strong>${userName}</strong>,</p>
                    
//                     <div class="welcome-box">
//                         <h2>🎉 Welcome Aboard!</h2>
//                         <p>We're thrilled to have you join the ${schoolName} community.</p>
//                     </div>
                    
//                     <div class="details-box">
//                         <h3>Your Account Details:</h3>
//                         <p><strong>Role:</strong> ${role}</p>
//                         ${username ? `<p><strong>Username:</strong> ${username}</p>` : ''}
//                         <p><strong>Email:</strong> ${email}</p>
//                     </div>
                    
//                     <p>You can now log in to your account and start exploring all the features available to you.</p>
                    
//                     <div class="footer">
//                         <p>Best regards,<br>The ${schoolName} Team</p>
//                         <p>© ${new Date().getFullYear()} ${schoolName}</p>
//                     </div>
//                 </body>
//                 </html>
//             `,
//         };

//         try {
//             await this.transporter.sendMail(mailOptions);
//             console.log(`Welcome email sent to ${email} from ${schoolName}`);
//             return true;
//         } catch (error) {
//             console.error('Error sending welcome email:', error);
//             throw new Error('Failed to send welcome email');
//         }
//     }
// }

// // Create and export a singleton instance
// const emailService = new EmailService();
// module.exports = emailService;