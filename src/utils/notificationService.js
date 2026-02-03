// const Notice = require("../models/Notice");
// const User = require("../models/User");

// const formatDate = (date) => {
//     if (!date) return null;
//     return typeof date === 'string' ? date : date.toISOString().split('T')[0];
// };

// const sendProfileUpdateNotification = async ({ user, updatedBy, changes = [], updateType = 'employee' }) => {
//     try {
//         if (!user || !user._id || !user.school) {
//             console.error('User data missing for notification');
//             return null;
//         }

//         const getProfileUpdateTitle = (role) => {
//             const titles = {
//                 teacher: 'Teacher Profile Updated',
//                 admin_office: 'Staff Profile Updated',
//                 employee: 'Employee Profile Updated',
//                 default: 'Profile Information Updated'
//             };
//             return titles[role] || titles.default;
//         };

//         // Build notification message
//         const buildProfileUpdateMessage = (userName, changesList, role) => {
//             let message = `Dear ${userName},\n\n`;
//             message += `Your ${role} profile has been updated by the administration.\n\n`;

//             if (changesList && changesList.length > 0) {
//                 message += "Changes made:\n";
//                 changesList.forEach((change, index) => {
//                     message += `${index + 1}. ${change}\n`;
//                 });
//                 message += "\n";
//             } else {
//                 message += "Your profile details have been modified.\n\n";
//             }
//             return message;
//         };

//         const title = getProfileUpdateTitle(user.role || updateType);
//         const message = buildProfileUpdateMessage(user.name, changes, user.role || updateType);

//         // Determine target based on user role
//         let target;
//         let targetIds = [];

//         if (user.role === 'teacher') {
//             target = 'selected_teachers';
//             targetIds = [user._id];
//         } else if (user.role === 'student') {
//             target = 'selected_students';
//             targetIds = [user._id];
//         } else {
//             // For admin_office or other roles, use custom target
//             target = 'custom';
//         }

//         // Create notification
//         const notification = await Notice.create({
//             school: user.school,
//             title,
//             message,
//             createdBy: updatedBy,
//             target: target,
//             ...(target === 'selected_teachers' && { targetTeacherIds: targetIds }),
//             ...(target === 'selected_students' && { targetStudentIds: targetIds }),
//             category: 'general', // Using 'general' as it's in the enum
//             startDate: formatDate(new Date()),
//             pinned: false,
//             readBy: []
//         });

//         console.log(`Profile update notification sent to ${user.role || updateType}: ${user.name}`);
//         return notification;

//     } catch (error) {
//         console.error('Error sending profile update notification:', error);
//         return null;
//     }
// };

// const sendEmailChangeNotification = async ({ user, oldEmail, newEmail, updatedBy }) => {
//     try {
//         if (!user || !user._id || !user.school) {
//             console.error('User data missing for notification');
//             return null;
//         }

//         const buildEmailChangeMessage = (userName, oldEmail, newEmail) => {
//             let message = `Dear ${userName},\n\n`;
//             message += `Your account email has been updated by the school administration:\n\n`;
//             message += `Old Email: ${oldEmail}\n`;
//             message += `New Email: ${newEmail}\n\n`;
//             message += "An OTP has been sent to your new email address for verification.\n";
//             message += "Please verify your email to continue using your account.\n\n";

//             return message;
//         };

//         const title = 'Email Address Updated';
//         const message = buildEmailChangeMessage(user.name, oldEmail, newEmail);

//         let target;
//         let targetIds = [];

//         if (user.role === 'teacher') {
//             target = 'selected_teachers';
//             targetIds = [user._id];
//         } else if (user.role === 'student') {
//             target = 'selected_students';
//             targetIds = [user._id];
//         } else {
//             target = 'custom';
//         }

//         const notification = await Notice.create({
//             school: user.school,
//             title,
//             message,
//             createdBy: updatedBy,
//             target: target,
//             ...(target === 'selected_teachers' && { targetTeacherIds: targetIds }),
//             ...(target === 'selected_students' && { targetStudentIds: targetIds }),
//             category: 'general', 
//             startDate: formatDate(new Date()),
//             pinned: true,
//             readBy: []
//         });

//         console.log(`Email change notification sent to ${user.role}: ${user.name}`);
//         return notification;

//     } catch (error) {
//         console.error('Error sending email change notification:', error);
//         return null;
//     }
// };

// const sendBulkEmployeeNotifications = async ({ users, updatedBy, changes = [], notificationType = 'profile_update', emailData = null }) => {
//     try {
//         if (!users || !Array.isArray(users) || users.length === 0) {
//             console.error('No users specified for bulk notification');
//             return [];
//         }

//         const notifications = [];

//         const teachers = users.filter(user => user.role === 'teacher');
//         const adminStaff = users.filter(user => user.role === 'admin_office');

//         if (teachers.length > 0) {
//             for (const teacher of teachers) {
//                 let notification;

//                 if (notificationType === 'profile_update') {
//                     notification = await sendProfileUpdateNotification({
//                         user: teacher,
//                         updatedBy,
//                         changes,
//                         updateType: 'teacher'
//                     });
//                 } else if (notificationType === 'email_change' && emailData) {
//                     notification = await sendEmailChangeNotification({
//                         user: teacher,
//                         oldEmail: emailData.oldEmail,
//                         newEmail: emailData.newEmail,
//                         updatedBy
//                     });
//                 }

//                 if (notification) notifications.push(notification);
//             }
//         }

//         if (adminStaff.length > 0) {
//             for (const staff of adminStaff) {
//                 let notification;

//                 if (notificationType === 'profile_update') {
//                     notification = await sendProfileUpdateNotification({
//                         user: staff,
//                         updatedBy,
//                         changes,
//                         updateType: 'employee'
//                     });
//                 } else if (notificationType === 'email_change' && emailData) {
//                     notification = await sendEmailChangeNotification({
//                         user: staff,
//                         oldEmail: emailData.oldEmail,
//                         newEmail: emailData.newEmail,
//                         updatedBy
//                     });
//                 }

//                 if (notification) notifications.push(notification);
//             }
//         }

//         console.log(`Bulk notifications sent: ${notifications.length} total`);
//         return notifications;

//     } catch (error) {
//         console.error('Error sending bulk employee notifications:', error);
//         return [];
//     }
// };


// module.exports = {
//     sendProfileUpdateNotification,
//     sendEmailChangeNotification,
//     sendBulkEmployeeNotifications
// };
























const Notice = require("../models/Notice");
const User = require("../models/User");
const ClassSection = require("../models/ClassSection");
const School = require("../models/School");

const formatDate = (date) => {
    if (!date) return null;
    return typeof date === 'string' ? date : date.toISOString().split('T')[0];
};

// Notification types enum
const NOTIFICATION_TYPES = {
    PROFILE_UPDATE: 'profile_update',
    EMAIL_CHANGE: 'email_change',
    RESULT: 'result',
    DIARY: 'diary',
    DOCUMENT: 'document',
    LEAVE: 'leave',
    ATTENDANCE: 'attendance',
    FEE: 'fee',
    EXAM: 'exam',
    HOMEWORK: 'homework',
    EVENT: 'event',
    CUSTOM: 'custom'
};

// Notification categories (aligned with Notice model)
const NOTIFICATION_CATEGORIES = {
    NOTICE: 'notice',
    MEETING: 'meeting',
    HOLIDAY: 'holiday',
    GENERAL: 'general'
};

// Notification targets (aligned with Notice model)
const NOTIFICATION_TARGETS = {
    ALL_TEACHERS: 'all_teachers',
    SELECTED_TEACHERS: 'selected_teachers',
    ALL_STUDENTS: 'all_students',
    SELECTED_STUDENTS: 'selected_students',
    ALL: 'all',
    CUSTOM: 'custom',
    CLASS: 'class',
    ADMIN: 'admin'
};

/**
 * Unified notification creation function for all services
 * @param {Object} params - Notification parameters
 * @param {String} params.type - Type of notification (from NOTIFICATION_TYPES)
 * @param {Object} params.actor - User who triggered the action (required)
 * @param {Array} [params.targetUsers] - Array of target user IDs who should receive the notification
 * @param {Array} [params.targetTeachers] - Array of target teacher IDs
 * @param {Array} [params.targetStudents] - Array of target student IDs
 * @param {String|Object} params.school - School ID or school object (required)
 * @param {String} [params.classId] - Class ID (optional)
 * @param {String} [params.sectionId] - Section ID (optional)
 * @param {String} [params.title] - Custom title (optional, will be auto-generated if not provided)
 * @param {String} [params.message] - Custom message (optional, will be auto-generated if not provided)
 * @param {Array} [params.changes] - Array of change descriptions (for profile updates)
 * @param {Object} [params.data] - Additional data for notification (oldEmail, newEmail, resultType, diaryTitle, documentType, etc.)
 * @param {String} [params.category] - Notification category (from NOTIFICATION_CATEGORIES)
 * @param {Boolean} [params.pinned] - Whether notification should be pinned
 * @param {String} [params.target] - Direct target override (from NOTIFICATION_TARGETS)
 * @returns {Promise<Object|null>} Created notification or null on error
 */
const createNotification = async (params) => {
    try {
        console.log('========== CREATE NOTIFICATION START ==========');
        console.log('createNotification called with params:', {
            type: params.type,
            actor: params.actor?._id,
            actorName: params.actor?.name,
            actorRole: params.actor?.role,
            target: params.target,
            targetAdmins: params.targetAdmins?.length,
            targetTeachers: params.targetTeachers?.length,
            targetStudents: params.targetStudents?.length,
            targetUsers: params.targetUsers?.length,
            title: params.title
        });

        const {
            type = NOTIFICATION_TYPES.CUSTOM,
            actor,
            targetUsers = [],
            targetTeachers = [],
            targetStudents = [],
            targetAdmins = [],
            school,
            classId,
            sectionId,
            title,
            message,
            changes = [],
            data = {},
            category = NOTIFICATION_CATEGORIES.GENERAL,
            pinned = false,
            target: explicitTarget
        } = params;

        // Validate required parameters
        if (!actor || !actor._id) {
            console.error('Missing actor parameter for notification');
            return null;
        }

        // Extract school ID from various possible formats
        let schoolId;
        if (typeof school === 'string' || school instanceof String) {
            schoolId = school;
        } else if (school && school._id) {
            schoolId = school._id;
        } else if (school && school.id) {
            schoolId = school.id;
        } else if (actor.school) {
            schoolId = actor.school;
        } else {
            console.error('Missing school parameter for notification');
            return null;
        }

        console.log('School ID for notification:', schoolId);

        // Use explicit target if provided, otherwise determine based on arrays
        let target = explicitTarget || NOTIFICATION_TARGETS.CUSTOM;
        let finalTargetAdmins = [];
        let finalTargetTeachers = [];
        let finalTargetStudents = [];

        console.log('Initial arrays:', {
            targetAdmins: targetAdmins.length,
            targetTeachers: targetTeachers.length,
            targetStudents: targetStudents.length,
            targetUsers: targetUsers.length
        });

        // If explicit target is set, use the corresponding array
        if (explicitTarget) {
            console.log('Using explicit target:', explicitTarget);

            switch (explicitTarget) {
                case NOTIFICATION_TARGETS.ADMIN:
                    finalTargetAdmins = targetAdmins.length > 0 ? targetAdmins : targetUsers;
                    break;
                case NOTIFICATION_TARGETS.SELECTED_TEACHERS:
                    finalTargetTeachers = targetTeachers.length > 0 ? targetTeachers : targetUsers;
                    break;
                case NOTIFICATION_TARGETS.SELECTED_STUDENTS:
                    finalTargetStudents = targetStudents.length > 0 ? targetStudents : targetUsers;
                    break;
            }
        } else {
            // Auto-detect based on which array has data
            if (targetAdmins.length > 0) {
                target = NOTIFICATION_TARGETS.ADMIN;
                finalTargetAdmins = targetAdmins;
                console.log('Setting target to ADMIN based on targetAdmins');
            } else if (targetTeachers.length > 0) {
                target = NOTIFICATION_TARGETS.SELECTED_TEACHERS;
                finalTargetTeachers = targetTeachers;
                console.log('Setting target to SELECTED_TEACHERS based on targetTeachers');
            } else if (targetStudents.length > 0) {
                target = NOTIFICATION_TARGETS.SELECTED_STUDENTS;
                finalTargetStudents = targetStudents;
                console.log('Setting target to SELECTED_STUDENTS based on targetStudents');
            } else if (targetUsers.length > 0) {
                console.log('targetUsers provided, determining roles...');
                // Determine user roles
                try {
                    const users = await User.find({ _id: { $in: targetUsers } }).select('role');
                    console.log('Found users:', users.length);

                    const admins = users.filter(u => ['admin_office', 'superadmin', 'school'].includes(u.role)).map(u => u._id);
                    const teachers = users.filter(u => u.role === 'teacher').map(u => u._id);
                    const students = users.filter(u => u.role === 'student').map(u => u._id);

                    console.log('Role distribution:', {
                        admins: admins.length,
                        teachers: teachers.length,
                        students: students.length
                    });

                    if (admins.length > 0) {
                        target = NOTIFICATION_TARGETS.ADMIN;
                        finalTargetAdmins = admins;
                        console.log('Setting target to ADMIN based on user roles');
                    } else if (teachers.length > 0) {
                        target = NOTIFICATION_TARGETS.SELECTED_TEACHERS;
                        finalTargetTeachers = teachers;
                        console.log('Setting target to SELECTED_TEACHERS based on user roles');
                    } else if (students.length > 0) {
                        target = NOTIFICATION_TARGETS.SELECTED_STUDENTS;
                        finalTargetStudents = students;
                        console.log('Setting target to SELECTED_STUDENTS based on user roles');
                    }
                } catch (error) {
                    console.error('Error determining user roles:', error);
                }
            } else {
                console.log('No target arrays provided, using CUSTOM target');
            }
        }

        console.log('Final target determination:', {
            target: target,
            adminCount: finalTargetAdmins.length,
            teacherCount: finalTargetTeachers.length,
            studentCount: finalTargetStudents.length
        });

        // Get default title and message
        const notificationTitle = title || getDefaultTitle(type, data);
        const notificationMessage = message || getDefaultMessage(type, data, changes, actor);

        console.log('Notification content:', {
            title: notificationTitle,
            messagePreview: notificationMessage.substring(0, 100) + '...'
        });

        // Prepare notification data
        const notificationData = {
            school: schoolId,
            title: notificationTitle,
            message: notificationMessage,
            createdBy: actor._id,
            target: target,
            category: category,
            startDate: formatDate(new Date()),
            pinned: pinned,
            readBy: []
        };

        // Add target-specific arrays based on target type
        if (target === NOTIFICATION_TARGETS.ADMIN && finalTargetAdmins.length > 0) {
            notificationData.targetAdminIds = finalTargetAdmins;
            console.log('Added targetAdminIds:', finalTargetAdmins.length);
        } else if (target === NOTIFICATION_TARGETS.SELECTED_TEACHERS && finalTargetTeachers.length > 0) {
            notificationData.targetTeacherIds = finalTargetTeachers;
            console.log('Added targetTeacherIds:', finalTargetTeachers.length);
        } else if (target === NOTIFICATION_TARGETS.SELECTED_STUDENTS && finalTargetStudents.length > 0) {
            notificationData.targetStudentIds = finalTargetStudents;
            console.log('Added targetStudentIds:', finalTargetStudents.length);
        } else if (target === NOTIFICATION_TARGETS.CLASS && classId) {
            notificationData.classId = classId;
            if (sectionId) {
                notificationData.sectionId = sectionId;
            }
            console.log('Added class/section:', classId, sectionId);
        }

        console.log('Notification data before save:', {
            school: notificationData.school,
            target: notificationData.target,
            targetAdminIds: notificationData.targetAdminIds?.length || 0,
            targetTeacherIds: notificationData.targetTeacherIds?.length || 0,
            targetStudentIds: notificationData.targetStudentIds?.length || 0
        });

        const notification = await Notice.create(notificationData);

        console.log('Notification created successfully:', notification._id);
        console.log('========== CREATE NOTIFICATION END ==========');
        return notification;

    } catch (error) {
        console.error('Error creating notification:', error);
        console.error('Error details:', error.message);
        return null;
    }
};
/**
 * Get default title based on notification type
 */
const getDefaultTitle = (type, data) => {
    const titles = {
        [NOTIFICATION_TYPES.PROFILE_UPDATE]: 'Profile Updated',
        [NOTIFICATION_TYPES.EMAIL_CHANGE]: 'Email Address Updated',
        [NOTIFICATION_TYPES.RESULT]: data.resultType === 'creation' ? 'New Result Published' : 'Result Updated',
        [NOTIFICATION_TYPES.DIARY]: data.diaryType === 'creation' ? 'New Diary Assignment' : 'Diary Updated',
        [NOTIFICATION_TYPES.DOCUMENT]: data.documentType === 'request' ? 'Document Request' : 'Document Uploaded',
        [NOTIFICATION_TYPES.LEAVE]: data.leaveType === 'application' ? 'Leave Application' : 'Leave Status Updated',
        [NOTIFICATION_TYPES.ATTENDANCE]: 'Attendance Update',
        [NOTIFICATION_TYPES.FEE]: 'Fee Update',
        [NOTIFICATION_TYPES.EXAM]: 'Exam Schedule Update',
        [NOTIFICATION_TYPES.HOMEWORK]: 'New Homework',
        [NOTIFICATION_TYPES.EVENT]: 'New Event',
        [NOTIFICATION_TYPES.CUSTOM]: 'New Notification'
    };

    return titles[type] || titles[NOTIFICATION_TYPES.CUSTOM];
};

/**
 * Get default message based on notification type
 */
const getDefaultMessage = (type, data, changes, actor) => {
    let message = '';

    switch (type) {
        case NOTIFICATION_TYPES.PROFILE_UPDATE:
            message = `Your profile has been updated`;
            if (changes && changes.length > 0) {
                changes.forEach((change, index) => {
                    message += `${index + 1}. ${change}\n`;
                });
            }
            break;

        case NOTIFICATION_TYPES.EMAIL_CHANGE:
            message = `Your email address has been updated.\n`;
            message += `Old Email: ${data.oldEmail || 'N/A'}\n`;
            message += `New Email: ${data.newEmail || 'N/A'}`;
            break;

        case NOTIFICATION_TYPES.RESULT:
            const resultAction = data.resultType === 'creation' ? 'added' : 'updated';
            message = `Your ${data.examType || 'exam'} result has been ${resultAction} by ${actor.name}.`;
            break;

        case NOTIFICATION_TYPES.DIARY:
            const diaryAction = data.diaryType === 'creation' ? 'assigned' : 'updated';
            message = `A new diary has been ${diaryAction} by ${actor.name}.\n`;
            if (data.dueDate) {
                message += `Due Date: ${formatDate(data.dueDate)}`;
            }
            break;

        case NOTIFICATION_TYPES.DOCUMENT:
            if (data.documentType === 'request') {
                message = `A document request has been made by ${actor.name}.\n`;
                if (data.dueDate) {
                    message += `Due Date: ${formatDate(data.dueDate)}`;
                }
            } else {
                message = `A document has been uploaded by ${actor.name}.\n`;
                message += `Request: ${data.requestTitle || 'Document Upload'}`;
            }
            break;

        case NOTIFICATION_TYPES.LEAVE:
            if (data.leaveType === 'application') {
                message = `A leave application has been submitted by ${actor.name}.\n`;
            } else {
                message = `Your leave application status has been updated to "${data.status || 'updated'}" by ${actor.name}.`;
            }
            break;

        default:
            message = `You have a new notification from ${actor.name}.`;
    }

    return message;
};

/**
 * Helper function to get users from class/section
 */
const getUsersFromClassSection = async (classId, sectionId, schoolId, roles = ['student']) => {
    try {
        const query = {
            school: schoolId,
            'classInfo.id': classId,
            role: { $in: roles }
        };

        if (sectionId) {
            query['sectionInfo.id'] = sectionId;
        }

        const users = await User.find(query).select('_id role name');
        return users;
    } catch (error) {
        console.error('Error getting users from class/section:', error);
        return [];
    }
};

/**
 * Send profile update notification (for backward compatibility)
 */
const sendProfileUpdateNotification = async ({ user, updatedBy, changes = [], updateType = 'employee' }) => {
    return createNotification({
        type: NOTIFICATION_TYPES.PROFILE_UPDATE,
        actor: updatedBy,
        targetUsers: [user._id],
        school: user.school,
        changes,
        data: { updateType }
    });
};

/**
 * Send email change notification (for backward compatibility)
 */
const sendEmailChangeNotification = async ({ user, oldEmail, newEmail, updatedBy }) => {
    return createNotification({
        type: NOTIFICATION_TYPES.EMAIL_CHANGE,
        actor: updatedBy,
        targetUsers: [user._id],
        school: user.school,
        data: { oldEmail, newEmail }
    });
};

/**
 * Send bulk notifications (for backward compatibility)
 */
const sendBulkEmployeeNotifications = async ({ users, updatedBy, changes = [], notificationType = NOTIFICATION_TYPES.PROFILE_UPDATE, emailData = null }) => {
    try {
        if (!users || !Array.isArray(users) || users.length === 0) {
            console.error('No users specified for bulk notification');
            return [];
        }

        const notifications = [];
        const userGroups = {};

        // Group users by role for efficient notification
        users.forEach(user => {
            if (!userGroups[user.role]) {
                userGroups[user.role] = [];
            }
            userGroups[user.role].push(user);
        });

        // Create notifications for each group
        for (const [role, roleUsers] of Object.entries(userGroups)) {
            for (const user of roleUsers) {
                let notification;

                if (notificationType === NOTIFICATION_TYPES.PROFILE_UPDATE) {
                    notification = await createNotification({
                        type: NOTIFICATION_TYPES.PROFILE_UPDATE,
                        actor: updatedBy,
                        targetUsers: [user._id],
                        school: user.school,
                        changes,
                        data: { updateType: role }
                    });
                } else if (notificationType === NOTIFICATION_TYPES.EMAIL_CHANGE && emailData) {
                    notification = await createNotification({
                        type: NOTIFICATION_TYPES.EMAIL_CHANGE,
                        actor: updatedBy,
                        targetUsers: [user._id],
                        school: user.school,
                        data: {
                            oldEmail: emailData.oldEmail,
                            newEmail: emailData.newEmail
                        }
                    });
                }

                if (notification) notifications.push(notification);
            }
        }

        console.log(`Bulk notifications sent: ${notifications.length} total`);
        return notifications;

    } catch (error) {
        console.error('Error sending bulk notifications:', error);
        return [];
    }
};

/**
 * Create result notification
 */
const sendResultNotification = async ({ result, actor, action = 'creation' }) => {
    try {
        // Get student information
        const student = await User.findById(result.studentId).select('name classInfo sectionInfo school');

        if (!student) {
            console.error('Student not found for result notification');
            return null;
        }

        return createNotification({
            type: NOTIFICATION_TYPES.RESULT,
            actor,
            targetUsers: [result.studentId],
            school: result.school || student.school,
            classId: result.classId || student.classInfo?.id,
            sectionId: result.sectionId || student.sectionInfo?.id,
            data: {
                resultType: action,
                examType: result.examType,
                marks: {
                    marksObtained: result.marksObtained,
                    totalMarks: result.totalMarks,
                    percentage: result.percentage,
                    position: result.position
                }
            }
        });
    } catch (error) {
        console.error('Error sending result notification:', error);
        return null;
    }
};

/**
 * Create diary notification
 */
const sendDiaryNotification = async ({ diary, actor, action = 'creation', targetStudentIds = [] }) => {
    try {
        // If targetStudentIds is provided, use it, otherwise get all students from class/section
        let finalTargetStudents = targetStudentIds;

        if (finalTargetStudents.length === 0 && diary.forAll) {
            const students = await getUsersFromClassSection(
                diary.classId,
                diary.sectionId,
                diary.school,
                ['student']
            );
            finalTargetStudents = students.map(s => s._id);
        }

        // Get subject name if available
        const subjectName = diary.subjectId?.name || 'Subject';

        return createNotification({
            type: NOTIFICATION_TYPES.DIARY,
            actor,
            targetStudents: finalTargetStudents,
            school: diary.school,
            classId: diary.classId,
            sectionId: diary.sectionId,
            data: {
                diaryType: action,
                diaryTitle: diary.title,
                subjectName,
                dueDate: diary.dueDate
            },
            pinned: true // Diary notifications are usually important
        });
    } catch (error) {
        console.error('Error sending diary notification:', error);
        return null;
    }
};


const sendDocumentRequestNotification = async ({ documentRequest, actor, targetType = 'student' }) => {
    try {

        // Get student details for the message
        const student = await User.findById(documentRequest.studentId).select('name');

        // Build notification message
        const message = `Document request "${documentRequest.title}" has been created by ${actor.name}.`;

        // Determine school ID from various sources
        let schoolId = documentRequest.school;

        // If school is not on documentRequest, try to get it from student or actor
        if (!schoolId) {
            if (student && student.school) {
                schoolId = student.school;
            } else if (actor && actor.school) {
                schoolId = actor.school;
            }
        }

        console.log('School ID determined:', schoolId);

        // ALWAYS notify student when document request is created
        // (regardless of who creates it - teacher, admin, or school)
        console.log('Creating student notification for student:', documentRequest.studentId);

        const notification = await createNotification({
            type: NOTIFICATION_TYPES.DOCUMENT,
            actor: actor,
            school: schoolId,
            targetStudents: [documentRequest.studentId],
            target: NOTIFICATION_TARGETS.SELECTED_STUDENTS,
            classId: documentRequest.classId,
            sectionId: documentRequest.sectionId,
            title: 'New Document Request',
            message: message,
            data: {
                documentType: 'request',
                requestId: documentRequest._id,
                requestType: documentRequest.requestType,
                dueDate: documentRequest.dueDate
            },
            category: NOTIFICATION_CATEGORIES.GENERAL,
            pinned: false
        });

        console.log('Student notification created:', notification ? 'Yes' : 'No');
        return notification;

    } catch (error) {
        console.error('Error sending document request notification:', error);
        return null;
    }
};

/**
 * Create document upload notification
 */
const sendDocumentUploadNotification = async ({ studentDocument, actor }) => {
    try {
        console.log('Document Upload Notification Debug:', {
            actorRole: actor.role,
            actorName: actor.name,
            studentDocumentId: studentDocument._id,
            requestedBy: studentDocument.requestedBy,
            requestedByModel: studentDocument.requestedByModel,
            uploadedFor: studentDocument.uploadedFor,
            school: studentDocument.school
        });

        let requester = null;
        let requesterRole = null;
        let schoolId = studentDocument.school;

        // Get requester information based on requestedByModel
        if (studentDocument.requestedByModel === 'User') {
            requester = await User.findById(studentDocument.requestedBy)
                .select('name role school _id');
            if (requester) {
                requesterRole = requester.role;
                // If schoolId is not in studentDocument, try to get it from requester
                if (!schoolId && requester.school) {
                    schoolId = requester.school;
                }
            }
        } else if (studentDocument.requestedByModel === 'School') {
            // Requester is a School, not a User
            const school = await School.findById(studentDocument.requestedBy)
                .select('name email schoolId');
            if (school) {
                requester = {
                    _id: school._id,
                    name: school.name,
                    role: 'school'
                };
                requesterRole = 'school';
                // If schoolId is not in studentDocument, use the school's ID
                if (!schoolId) {
                    schoolId = school._id;
                }
            }
        }

        if (!requester) {
            console.error('Requester not found for document upload notification');
            return null;
        }

        console.log('Requester information:', {
            id: requester._id,
            name: requester.name,
            role: requesterRole,
            model: studentDocument.requestedByModel
        });

        // Get student information for message
        const student = await User.findById(studentDocument.studentId).select('name');

        // Build message
        const message = `Document "${studentDocument.text || 'Untitled'}" has been uploaded by ${actor.name}.\n\n` +
            `Student: ${student?.name || 'Unknown'}\n` +
            `Request: ${studentDocument.requestDetails || 'No details provided'}`;

        console.log('Actor role:', actor.role, 'Requester role:', requesterRole);

        // Case 1: Student uploaded document (most common case)
        if (actor.role === 'student') {
            console.log('Student uploaded document - checking requester role');

            if (requesterRole === 'teacher') {
                // Student uploaded, teacher requested - notify the teacher
                console.log('Notifying teacher:', requester._id);
                return createNotification({
                    type: NOTIFICATION_TYPES.DOCUMENT,
                    actor: actor,
                    school: schoolId,
                    targetTeachers: [requester._id],
                    target: NOTIFICATION_TARGETS.SELECTED_TEACHERS,
                    title: 'Document Uploaded by Student',
                    message: message,
                    data: {
                        documentType: 'upload',
                        requestTitle: studentDocument.requestDetails,
                        documentId: studentDocument._id,
                        uploadedBy: 'student'
                    },
                    category: NOTIFICATION_CATEGORIES.GENERAL,
                    pinned: false
                });
            } else if (requesterRole === 'admin_office' || requesterRole === 'superadmin' || requesterRole === 'school') {
                // Student uploaded, admin/school requested - notify all admins
                console.log('Notifying all admins for school:', schoolId);
                const adminUsers = await User.find({
                    school: schoolId,
                    role: { $in: ['admin_office', 'superadmin'] }
                }).select('_id');

                console.log('Admin users found:', adminUsers.length);

                return createNotification({
                    type: NOTIFICATION_TYPES.DOCUMENT,
                    actor: actor,
                    school: schoolId,
                    targetAdmins: adminUsers.map(u => u._id),
                    target: NOTIFICATION_TARGETS.ADMIN,
                    title: 'Document Uploaded by Student',
                    message: message,
                    data: {
                        documentType: 'upload',
                        requestTitle: studentDocument.requestDetails,
                        documentId: studentDocument._id,
                        uploadedBy: 'student'
                    },
                    category: NOTIFICATION_CATEGORIES.GENERAL,
                    pinned: false
                });
            }
        }
        // Case 2: Teacher uploaded document
        else if (actor.role === 'teacher') {
            console.log('Teacher uploaded document');

            // Teacher uploaded - notify the original requester
            if (requesterRole === 'teacher') {
                // Notify teacher
                return createNotification({
                    type: NOTIFICATION_TYPES.DOCUMENT,
                    actor: actor,
                    school: schoolId,
                    targetTeachers: [requester._id],
                    target: NOTIFICATION_TARGETS.SELECTED_TEACHERS,
                    title: 'Document Uploaded by Teacher',
                    message: message,
                    data: {
                        documentType: 'upload',
                        requestTitle: studentDocument.requestDetails,
                        documentId: studentDocument._id,
                        uploadedBy: 'teacher'
                    },
                    category: NOTIFICATION_CATEGORIES.GENERAL,
                    pinned: false
                });
            } else if (requesterRole === 'admin_office' || requesterRole === 'superadmin' || requesterRole === 'school') {
                // Notify all admins
                const adminUsers = await User.find({
                    school: schoolId,
                    role: { $in: ['admin_office', 'superadmin'] }
                }).select('_id');

                return createNotification({
                    type: NOTIFICATION_TYPES.DOCUMENT,
                    actor: actor,
                    school: schoolId,
                    targetAdmins: adminUsers.map(u => u._id),
                    target: NOTIFICATION_TARGETS.ADMIN,
                    title: 'Document Uploaded by Teacher',
                    message: message,
                    data: {
                        documentType: 'upload',
                        requestTitle: studentDocument.requestDetails,
                        documentId: studentDocument._id,
                        uploadedBy: 'teacher'
                    },
                    category: NOTIFICATION_CATEGORIES.GENERAL,
                    pinned: false
                });
            }
        }
        // Case 3: School/Admin uploaded document
        else if (actor.role === 'school' || actor.role === 'admin_office' || actor.role === 'superadmin' || !actor.role) {
            console.log('Admin/School uploaded document');

            // Admin uploaded - notify all admins
            const adminUsers = await User.find({
                school: schoolId,
                role: { $in: ['admin_office', 'superadmin'] }
            }).select('_id');

            return createNotification({
                type: NOTIFICATION_TYPES.DOCUMENT,
                actor: actor,
                school: schoolId,
                targetAdmins: adminUsers.map(u => u._id),
                target: NOTIFICATION_TARGETS.ADMIN,
                title: 'Document Uploaded',
                message: message,
                data: {
                    documentType: 'upload',
                    requestTitle: studentDocument.requestDetails,
                    documentId: studentDocument._id,
                    uploadedBy: 'admin'
                },
                category: NOTIFICATION_CATEGORIES.GENERAL,
                pinned: false
            });
        }

        console.log('No notification created - unknown uploader type or requester role');
        return null;

    } catch (error) {
        console.error('Error sending document upload notification:', error);
        console.error('Error stack:', error.stack);
        return null;
    }
};

const sendStudentLeaveNotification = async ({ leave, actor, action = 'create' }) => {
    try {
        if (leave.userType === 'teacher') {
            return sendTeacherLeaveNotification({ leave, actor, action });
        }

        const adminUsers = await User.find({
            school: leave.school,
            role: { $in: ['admin_office', 'superadmin', 'school'] }
        }).select('_id');

        if (action === 'create' || action === 'update' || action === 'cancel') {
            return createNotification({
                type: NOTIFICATION_TYPES.LEAVE,
                actor,
                school: leave.school,
                targetAdmins: adminUsers.map(u => u._id),
                target: NOTIFICATION_TARGETS.ADMIN,
                title: `Student Leave ${getActionText(action)}`,
                message: getStudentLeaveMessage(leave, actor, action),
                data: {
                    leaveType: 'student',
                    action: action,
                    leaveId: leave._id,
                    studentName: leave.studentName,
                    dates: leave.dates,
                    status: leave.status
                },
                category: NOTIFICATION_CATEGORIES.GENERAL,
                pinned: false
            });
        } else if (action === 'approve' || action === 'reject') {
            return createNotification({
                type: NOTIFICATION_TYPES.LEAVE,
                actor,
                school: leave.school,
                targetStudents: [leave.studentId],
                target: NOTIFICATION_TARGETS.SELECTED_STUDENTS,
                title: `Leave ${action === 'approve' ? 'Approved' : 'Rejected'}`,
                message: getStudentLeaveMessage(leave, actor, action),
                data: {
                    leaveType: 'student',
                    action: action,
                    leaveId: leave._id,
                    dates: leave.dates,
                    status: leave.status,
                    remark: leave.remark
                },
                category: NOTIFICATION_CATEGORIES.GENERAL,
                pinned: false
            });
        }
    } catch (error) {
        console.error('Error sending student leave notification:', error);
        return null;
    }
};


//  Send notification for teacher leave application
const sendTeacherLeaveNotification = async ({ leave, actor, action = 'create' }) => {
    try {
        const adminUsers = await User.find({
            school: leave.school,
            role: { $in: ['admin_office', 'superadmin', 'school'] }
        }).select('_id');

        if (action === 'create' || action === 'update' || action === 'cancel') {
            return createNotification({
                type: NOTIFICATION_TYPES.LEAVE,
                actor,
                school: leave.school,
                targetAdmins: adminUsers.map(u => u._id),
                target: NOTIFICATION_TARGETS.ADMIN,
                title: `Teacher Leave ${getActionText(action)}`,
                message: getTeacherLeaveMessage(leave, actor, action),
                data: {
                    leaveType: 'teacher',
                    action: action,
                    leaveId: leave._id,
                    teacherName: leave.teacherName,
                    dates: leave.dates,
                    status: leave.status
                },
                category: NOTIFICATION_CATEGORIES.GENERAL,
                pinned: false
            });
        } else if (action === 'approve' || action === 'reject') {
            return createNotification({
                type: NOTIFICATION_TYPES.LEAVE,
                actor,
                school: leave.school,
                targetTeachers: [leave.teacherId],
                target: NOTIFICATION_TARGETS.SELECTED_TEACHERS,
                title: `Leave ${action === 'approve' ? 'Approved' : 'Rejected'}`,
                message: getTeacherLeaveMessage(leave, actor, action),
                data: {
                    leaveType: 'teacher',
                    action: action,
                    leaveId: leave._id,
                    dates: leave.dates,
                    status: leave.status,
                    remark: leave.remark
                },
                category: NOTIFICATION_CATEGORIES.GENERAL,
                pinned: false
            });
        }
    } catch (error) {
        console.error('Error sending teacher leave notification:', error);
        return null;
    }
};

// Helper functions
const getActionText = (action) => {
    const actions = {
        'create': 'Application',
        'update': 'Updated',
        'cancel': 'Cancelled',
        'approve': 'Approved',
        'reject': 'Rejected'
    };
    return actions[action] || action;
};

const getStudentLeaveMessage = (leave, actor, action) => {
    let message = '';

    switch (action) {
        case 'create':
            message = `Leave application submitted by ${leave.studentName}.`;
            break;

        case 'update':
            message = `Leave application updated by ${leave.studentName}.`;
            break;

        case 'cancel':
            message = `Leave cancelled by ${leave.studentName}.`;
            break;

        case 'approve':
            message = `Your leave application has been approved by ${actor.name}.`;
            if (leave.remark) {
                message += `Remark: ${leave.remark}`;
            }
            break;

        case 'reject':
            message = `Your leave application has been rejected by ${actor.name}.`;
            if (leave.remark) {
                message += `Remark: ${leave.remark}`;
            }
            break;
    }

    return message;
};

const getTeacherLeaveMessage = (leave, actor, action) => {
    let message = '';

    switch (action) {
        case 'create':
            message = `Leave application submitted by teacher ${leave.teacherName}.`;
            break;

        case 'update':
            message = `Leave application updated by teacher ${leave.teacherName}.`;
            break;

        case 'cancel':
            message = `Leave cancelled by teacher ${leave.teacherName}.`;
            break;

        case 'approve':
            message = `Your leave application has been approved by ${actor.name}.`;
            break;

        case 'reject':
            message = `Your leave application has been rejected by ${actor.name}.`;
            break;
    }

    return message;
};

module.exports = {
    // Constants
    NOTIFICATION_TYPES,
    NOTIFICATION_CATEGORIES,
    NOTIFICATION_TARGETS,

    // Main unified function
    createNotification,

    // Helper functions
    getUsersFromClassSection,

    // Backward compatibility functions
    sendProfileUpdateNotification,
    sendEmailChangeNotification,
    sendBulkEmployeeNotifications,

    // Service-specific functions
    sendResultNotification,
    sendDiaryNotification,
    sendDocumentRequestNotification,
    sendDocumentUploadNotification,
    sendStudentLeaveNotification,
    sendTeacherLeaveNotification
};