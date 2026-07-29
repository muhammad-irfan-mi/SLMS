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

    async sendSchoolForgotPasswordOTPEmail(email, otpCode, schoolName) {
        return this.sendEmail({
            to: email,
            subject: "School Password Reset OTP",
            html: this.generateTemplate({
                title: "Password Reset",
                message: `Hello <strong>${schoolName}</strong>, use the code below to reset your school account password.`,
                otp: otpCode,
                schoolName
            }),
        });
    }

    async sendSchoolPasswordChangedNotification(email, schoolName) {
        return this.sendEmail({
            to: email,
            subject: "School Password Changed Successfully",
            html: this.generateTemplate({
                title: "Password Updated",
                message: `Hello ${schoolName}, your school account password has been changed successfully. If you did not make this change, please contact support immediately.`,
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

    async sendAccountDeletionNotification(email, userName, permanentDeletionDate) {
        return this.sendEmail({
            to: email,
            subject: "Account Deletion Request",
            html: this.generateTemplate({
                title: "Account Deletion Request",
                message: `
Hello ${userName},<br/><br/>
You have requested to delete your account. Your account will be permanently deleted on <strong>${permanentDeletionDate.toDateString()}</strong>.<br/><br/>
If you wish to restore your account, please login before that date.<br/><br/>
If you did not request this, please contact your school administrator immediately.
            `,
                schoolName: "School Management System"
            })
        });
    }
}



module.exports = new EmailService();