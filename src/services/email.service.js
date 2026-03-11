// const { Resend } = require('resend');
// const School = require('../models/School');

// const resend = new Resend(process.env.RESEND_API_KEY);

// class EmailService {

//     constructor() {
//         this.from = `School Management System <noreply@khaiyal.com>`;
//     }

//     generateTemplate({ title, message, otp = null, username = null, schoolName = "School Management System" }) {
//         return `
//   <div style="margin:0;padding:0;background:#f4f4f7;font-family:Arial,sans-serif;">
//     <div style="max-width:600px;margin:30px auto;background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 4px 10px rgba(0,0,0,0.05);">

//       <!-- Header -->
//       <div style="padding:20px;text-align:center;">
//         <div style="font-size:22px;font-weight:bold;color:#1a4fa3;">
//           🎓 ${schoolName}
//         </div>
//       </div>

//       <div style="background:#1a4fa3;color:#ffffff;padding:12px;text-align:center;font-weight:bold;">
//         ${title}
//       </div>

//       <!-- Body -->
//       <div style="padding:30px;">
//         ${username ? `<p><strong>Username:</strong> ${username}</p>` : ""}
//         <p style="color:#444;">${message}</p>

//         ${otp ? `
//           <div style="margin:25px 0;padding:20px;text-align:center;border:1px solid #eee;border-radius:6px;background:#f9fafc;">
//             <p style="margin:0;color:#777;">Your Verification Code:</p>
//             <h1 style="margin:10px 0;color:#1a4fa3;font-size:32px;letter-spacing:3px;">
//               ${otp}
//             </h1>
//             <p style="margin:0;color:#777;">This code is valid for 10 minutes.</p>
//           </div>
//         ` : ""}

//         <div style="margin-top:25px;font-size:14px;color:#666;">
//           <p><strong>For your security:</strong></p>
//           <ul>
//             <li>Do not share this code with anyone.</li>
//             <li>We will never ask for this code.</li>
//           </ul>
//         </div>
//       </div>

//       <!-- Footer -->
//       <div style="background:#f4f4f7;padding:15px;text-align:center;font-size:12px;color:#888;">
//         © ${new Date().getFullYear()} ${schoolName}. All rights reserved.
//       </div>

//     </div>
//   </div>
//   `;
//     }

//     async sendEmail({ to, subject, html }) {
//         try {
//             const response = await resend.emails.send({
//                 from: this.from,
//                 to,
//                 subject,
//                 html
//             });

//             console.log("Email sent:", response.id);
//             return true;

//         } catch (error) {
//             console.error("Resend error:", error);
//             throw new Error("Failed to send email");
//         }
//     }

//     async getSchoolName(schoolId) {
//         try {
//             if (!schoolId) return "School Management System";
//             const school = await School.findById(schoolId);
//             return school ? school.name : "School Management System";
//         } catch {
//             return "School Management System";
//         }
//     }

//     // School OTP
//     async sendOTPEmail(email, otpCode, schoolName) {
//         return this.sendEmail({
//             to: email,
//             subject: "Verify Your School Registration",
//             html: `
//         <h2>School Registration Verification</h2>
//         <p>Dear ${schoolName},</p>
//         <h1>${otpCode}</h1>
//         <p>This OTP is valid for 10 minutes.</p>
//       `
//         });
//     }

//     // Password Setup
//     async sendPasswordSetupEmail(email, schoolName, schoolId) {
//         return this.sendEmail({
//             to: email,
//             subject: "Set Your School Account Password",
//             html: `
//         <h2>Welcome ${schoolName}</h2>
//         <p>Your School ID: <strong>${schoolId}</strong></p>
//         <a href="${process.env.FRONTEND_URL}/set-password?email=${encodeURIComponent(email)}&schoolId=${schoolId}">
//           Set Password
//         </a>
//       `
//         });
//     }

//     // User OTP
//     async sendUserOTPEmail(email, otpCode, username, schoolId) {
//         const schoolName = await this.getSchoolName(schoolId);

//         return this.sendEmail({
//             to: email,
//             subject: `Verify Your Account - ${schoolName}`,
//             //         html: `
//             //     <h2>Account Verification</h2>
//             //     <p><strong>Username:</strong> ${username}</p>
//             //     <h1>${otpCode}</h1>
//             //     <p>This OTP is valid for 10 minutes.</p>
//             //   `
//             html: this.generateTemplate({
//                 title: "Secure Account Verification",
//                 message: "We received a request to sign in to your account. Please use the verification code below.",
//                 otp: otpCode,
//                 username,
//                 schoolName
//             })
//         });
//     }

//     // Forgot Password OTP
//     async sendForgotPasswordOTPEmail(email, otpCode, userName) {
//         return this.sendEmail({
//             to: email,
//             subject: "Password Reset Verification",
//             //         html: `
//             //     <h2>Password Reset</h2>
//             //     <p>Dear ${userName},</p>
//             //     <h1>${otpCode}</h1>
//             //     <p>This OTP is valid for 10 minutes.</p>
//             //   `
//             html: this.generateTemplate({
//                 title: "Password Reset",
//                 message: `Hello ${userName}, use the code below to reset your password.`,
//                 otp: otpCode
//             })
//         });
//     }

//     // Password Changed Notification
//     async sendPasswordChangedNotification(email, userName) {
//         return this.sendEmail({
//             to: email,
//             subject: "Password Changed Successfully",
//             html: `
//         <h2>Password Updated</h2>
//         <p>Dear ${userName},</p>
//         <p>Your password has been changed successfully.</p>
//       `
//         });
//     }

//     // Student Registration
//     async sendStudentRegistrationEmail(email, otpCode, name, username, schoolId) {
//         const schoolName = await this.getSchoolName(schoolId);

//         return this.sendEmail({
//             to: email,
//             subject: `Student Account Created - ${schoolName}`,
//             html: `
//         <h2>Student Account Created</h2>
//         <p>Dear ${name},</p>
//         <p><strong>Username:</strong> ${username}</p>
//         <h1>${otpCode}</h1>
//         <p>This OTP is valid for 10 minutes.</p>
//       `
//         });
//     }

//     // Welcome Email
//     async sendWelcomeEmail(email, userName, role, username = null) {
//         return this.sendEmail({
//             to: email,
//             subject: "Welcome to School Management System",
//             //         html: `
//             //     <h2>Welcome ${userName}</h2>
//             //     <p>Role: ${role}</p>
//             //     ${username ? `<p>Username: ${username}</p>` : ''}
//             //   `
//             html: this.generateTemplate({
//                 title: "Welcome",
//                 message: `Hello ${userName}, your role is ${role}.`,
//                 username
//             })
//         });
//     }
// }

// module.exports = new EmailService();










const { Resend } = require("resend");
const School = require("../models/School");

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
                html,
            });

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

    generateTemplate({
        title,
        message,
        otp = null,
        username = null,
        schoolName,
        role,
    }) {


        let appDownloadMessage = "";

        if (role === "teacher") {
            appDownloadMessage = "Download Yushay App from Google Play Store";
        } else if (role === "student") {
            appDownloadMessage = "Download Yooyo App from Google Play Store";
        } else if (role === "admin_office") {
            appDownloadMessage = "Download Desktop App";
        }

        const showAppBox = ["teacher", "student", "admin_office"].includes(role);

        return `
    <div style="margin:0;padding:10px;background:#f4f4f7;font-family:Arial,sans-serif;">
      <div style="max-width:600px;margin:20px auto;background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 4px 10px rgba(0,0,0,0.05);">
        
        <!-- Header -->
        <div style="padding:20px;text-align:center;">
          <div style="font-size:22px;font-weight:bold;color:#1a4fa3;">
            🎓 ${schoolName}
          </div>
        </div>

        <div style="background:#1a4fa3;color:#ffffff;padding:12px;text-align:center;font-weight:bold;">
          ${title}
        </div>

        <!-- Body -->
        <div style="padding:10px 30px;">

       ${showAppBox
                ? `
        <div style="margin:20px 0;padding:15px;background:${role === 'teacher' ? '#e8f5e8' :
                    role === 'student' ? '#fff3e0' :
                        '#f0f0f0'
                };border-radius:8px;text-align:center;border-left:5px solid ${role === 'teacher' ? '#4CAF50' :
                    role === 'student' ? '#FF9800' :
                        '#9C27B0'
                };">

            <p style="margin:0;font-size:16px;font-weight:bold;color:${role === 'teacher' ? '#2e7d32' :
                    role === 'student' ? '#e65100' :
                        '#6a1b9a'
                };">
              ${appDownloadMessage}
            </p>
        </div>
        `
                : ""
            }

          ${username ? `<p><strong>Username: ${username}</strong></p>` : ""}
          <p style="color:#444;">${message}</p>

          ${otp
                ? `
            <div style="margin:15px 0;padding:20px;text-align:center;border:1px solid #eee;border-radius:6px;background:#f9fafc;">
              <p style="margin:0;color:#777;">Your Verification Code:</p>
              <h1 style="margin:5px 0;color:#1a4fa3;font-size:32px;letter-spacing:3px;">
                ${otp}
              </h1>
              <p style="margin:0;color:#777;">This code is valid for 10 minutes.</p>
            </div>
          `
                : ""
            }

        </div>

        <!-- Footer -->
        <div style="background:#f4f4f7;padding:5px;text-align:center;font-size:12px;color:#888;">
          © ${new Date().getFullYear()} A project by apna khaiyal (SMC Pvt. Ltd). All rights reserved.
          <br/>
          This is an automated message. Please do not reply.
        </div>

      </div>
    </div>
    `;
    }

    async sendOTPEmail(email, otpCode, schoolName) {
        return this.sendEmail({
            to: email,
            subject: "Verify Your School Registration",
            html: this.generateTemplate({
                title: "Secure Account Verification",
                message:
                    "We received a request to verify your school registration. Please use the code below.",
                otp: otpCode,
                schoolName,
            }),
        });
    }

    async sendPasswordSetupEmail(email, schoolName, schoolId) {
        const link = `${process.env.FRONTEND_URL}/set-password?email=${encodeURIComponent(
            email
        )}&schoolId=${schoolId}`;

        return this.sendEmail({
            to: email,
            subject: "Set Your School Account Password",
            html: this.generateTemplate({
                title: "Set Your Password",
                message: `
          Welcome ${schoolName}.<br/><br/>
          Please click the link below to set your password:<br/>
          <a href="${link}" style="color:#1a4fa3;font-weight:bold;">Set Password</a>
        `,
                schoolName,
            }),
        });
    }

    async sendUserOTPEmail(email, otpCode, username, schoolId, role) {
        const schoolName = await this.getSchoolName(schoolId);
        return this.sendEmail({
            to: email,
            subject: `Verify Your Account - ${schoolName}`,
            html: this.generateTemplate({
                title: "Secure Account Verification",
                message:
                    "We received a request to verify your school registration. Please use the verification code below to continue.",
                otp: otpCode,
                username,
                schoolName,
                role
            }),
        });
    }

    async sendForgotPasswordOTPEmail(email, otpCode, userName, schoolId) {
        const schoolName = await this.getSchoolName(schoolId);

        return this.sendEmail({
            to: email,
            subject: "Password Reset OTP",
            html: this.generateTemplate({
                title: "Password Reset",
                message: `Hello <strong>${userName}</strong>, use the code below to reset your password.`,
                otp: otpCode,
                schoolName
            }),
        });
    }

    async sendPasswordChangedNotification(email, userName, schoolId) {
        const schoolName = await this.getSchoolName(schoolId);
        return this.sendEmail({
            to: email,
            subject: "Password Changed Successfully",
            html: this.generateTemplate({
                title: "Password Updated",
                message: `Hello ${userName}, your password has been changed successfully.`,
                schoolName
            }),
        });
    }

    async sendStudentRegistrationEmail(
        email,
        otpCode,
        name,
        username,
        schoolId
    ) {
        const schoolName = await this.getSchoolName(schoolId);

        return this.sendEmail({
            to: email,
            subject: `Student Account Created - ${schoolName}`,
            html: this.generateTemplate({
                title: "Student Account Created",
                message: `Hello ${name}, your student account has been created successfully.`,
                otp: otpCode,
                username,
                schoolName,
                role: "student"
            }),
        });
    }

    async sendWelcomeEmail(email, userName, role, username = null) {
        return this.sendEmail({
            to: email,
            subject: "Welcome to School Management System",
            html: this.generateTemplate({
                title: "Welcome",
                message: `Hello ${userName}, your role is ${role}.`,
                username,
            }),
        });
    }
}



module.exports = new EmailService();