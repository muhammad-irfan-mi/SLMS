const Notice = require("../models/Notice");
const User = require("../models/User");

// Format date to YYYY-MM-DD string
const formatDate = (date) => {
    if (!date) return null;
    return typeof date === 'string' ? date : date.toISOString().split('T')[0];
};

const sendProfileUpdateNotification = async ({ user, updatedBy, changes = [], updateType = 'employee' }) => {
    try {
        if (!user || !user._id || !user.school) {
            console.error('User data missing for notification');
            return null;
        }

        const getProfileUpdateTitle = (role) => {
            const titles = {
                teacher: 'Teacher Profile Updated',
                admin_office: 'Staff Profile Updated',
                employee: 'Employee Profile Updated',
                default: 'Profile Information Updated'
            };
            return titles[role] || titles.default;
        };

        // Build notification message
        const buildProfileUpdateMessage = (userName, changesList, role) => {
            let message = `Dear ${userName},\n\n`;
            message += `Your ${role} profile has been updated by the administration.\n\n`;

            if (changesList && changesList.length > 0) {
                message += "Changes made:\n";
                changesList.forEach((change, index) => {
                    message += `${index + 1}. ${change}\n`;
                });
                message += "\n";
            } else {
                message += "Your profile details have been modified.\n\n";
            }
            return message;
        };

        const title = getProfileUpdateTitle(user.role || updateType);
        const message = buildProfileUpdateMessage(user.name, changes, user.role || updateType);

        // Determine target based on user role
        let target;
        let targetIds = [];

        if (user.role === 'teacher') {
            target = 'selected_teachers';
            targetIds = [user._id];
        } else if (user.role === 'student') {
            target = 'selected_students';
            targetIds = [user._id];
        } else {
            // For admin_office or other roles, use custom target
            target = 'custom';
        }

        // Create notification
        const notification = await Notice.create({
            school: user.school,
            title,
            message,
            createdBy: updatedBy,
            target: target,
            ...(target === 'selected_teachers' && { targetTeacherIds: targetIds }),
            ...(target === 'selected_students' && { targetStudentIds: targetIds }),
            category: 'general', // Using 'general' as it's in the enum
            startDate: formatDate(new Date()),
            pinned: false,
            readBy: []
        });

        console.log(`Profile update notification sent to ${user.role || updateType}: ${user.name}`);
        return notification;

    } catch (error) {
        console.error('Error sending profile update notification:', error);
        return null;
    }
};

const sendEmailChangeNotification = async ({ user, oldEmail, newEmail, updatedBy }) => {
    try {
        if (!user || !user._id || !user.school) {
            console.error('User data missing for notification');
            return null;
        }

        const buildEmailChangeMessage = (userName, oldEmail, newEmail) => {
            let message = `Dear ${userName},\n\n`;
            message += `Your account email has been updated by the school administration:\n\n`;
            message += `Old Email: ${oldEmail}\n`;
            message += `New Email: ${newEmail}\n\n`;
            message += "An OTP has been sent to your new email address for verification.\n";
            message += "Please verify your email to continue using your account.\n\n";

            return message;
        };

        const title = 'Email Address Updated';
        const message = buildEmailChangeMessage(user.name, oldEmail, newEmail);

        let target;
        let targetIds = [];

        if (user.role === 'teacher') {
            target = 'selected_teachers';
            targetIds = [user._id];
        } else if (user.role === 'student') {
            target = 'selected_students';
            targetIds = [user._id];
        } else {
            target = 'custom';
        }

        const notification = await Notice.create({
            school: user.school,
            title,
            message,
            createdBy: updatedBy,
            target: target,
            ...(target === 'selected_teachers' && { targetTeacherIds: targetIds }),
            ...(target === 'selected_students' && { targetStudentIds: targetIds }),
            category: 'general', 
            startDate: formatDate(new Date()),
            pinned: true,
            readBy: []
        });

        console.log(`Email change notification sent to ${user.role}: ${user.name}`);
        return notification;

    } catch (error) {
        console.error('Error sending email change notification:', error);
        return null;
    }
};

const sendBulkEmployeeNotifications = async ({ users, updatedBy, changes = [], notificationType = 'profile_update', emailData = null }) => {
    try {
        if (!users || !Array.isArray(users) || users.length === 0) {
            console.error('No users specified for bulk notification');
            return [];
        }

        const notifications = [];

        const teachers = users.filter(user => user.role === 'teacher');
        const adminStaff = users.filter(user => user.role === 'admin_office');

        if (teachers.length > 0) {
            for (const teacher of teachers) {
                let notification;

                if (notificationType === 'profile_update') {
                    notification = await sendProfileUpdateNotification({
                        user: teacher,
                        updatedBy,
                        changes,
                        updateType: 'teacher'
                    });
                } else if (notificationType === 'email_change' && emailData) {
                    notification = await sendEmailChangeNotification({
                        user: teacher,
                        oldEmail: emailData.oldEmail,
                        newEmail: emailData.newEmail,
                        updatedBy
                    });
                }

                if (notification) notifications.push(notification);
            }
        }

        if (adminStaff.length > 0) {
            for (const staff of adminStaff) {
                let notification;

                if (notificationType === 'profile_update') {
                    notification = await sendProfileUpdateNotification({
                        user: staff,
                        updatedBy,
                        changes,
                        updateType: 'employee'
                    });
                } else if (notificationType === 'email_change' && emailData) {
                    notification = await sendEmailChangeNotification({
                        user: staff,
                        oldEmail: emailData.oldEmail,
                        newEmail: emailData.newEmail,
                        updatedBy
                    });
                }

                if (notification) notifications.push(notification);
            }
        }

        console.log(`Bulk notifications sent: ${notifications.length} total`);
        return notifications;

    } catch (error) {
        console.error('Error sending bulk employee notifications:', error);
        return [];
    }
};

// Exam schedule notification
const sendExamNotification = async ({ schoolId, classId, sectionId, examData, createdBy, teacherId = null, notificationType = 'create' }) => {
    try {
        const classSection = await getClassSectionInfo(classId);
        if (!classSection) {
            console.error('Class not found for notification');
            return null;
        }

        const section = classSection.sections?.find(s => s._id.toString() === sectionId?.toString());
        const sectionName = section ? section.name : 'Unknown';

        const getExamNotificationContent = (examData, className, sectionName, type) => {
            const { subjectName, examDate, startTime, endTime, examType, teacherName = 'To be announced', changes = [] } = examData;
            const examDateObj = new Date(examDate);

            let title, message;

            switch (type) {
                case 'create':
                    title = `Exam Schedule - ${examType?.toUpperCase() || 'Exam'}`;
                    message = `${examType?.toUpperCase() || 'Exam'} Exam\n` +
                        `For: ${subjectName}\n` +
                        `Date: ${examDateObj.toDateString()}\n` +
                        `Time: ${startTime} - ${endTime}\n` +
                        `Class: ${className}, Section: ${sectionName}\n` +
                        `Teacher: ${teacherName}`;
                    break;

                case 'update':
                    title = `Exam Updated - ${examType?.toUpperCase() || 'Exam'}`;
                    message = `${examType?.toUpperCase() || 'Exam'} Exam Updated\n` +
                        `For: ${subjectName}\n` +
                        `Date: ${examDateObj.toDateString()}\n` +
                        `Time: ${startTime} - ${endTime}\n` +
                        `Class: ${className}, Section: ${sectionName}\n` +
                        `Teacher: ${teacherName}`;

                    if (changes.length > 0) {
                        message += `\n\nChanges:\n${changes.join('\n')}`;
                    }
                    break;

                case 'cancel':
                    title = `Exam Cancelled - ${examType?.toUpperCase() || 'Exam'}`;
                    message = `EXAM CANCELLED\n` +
                        `Subject: ${subjectName}\n` +
                        `Date: ${examDateObj.toDateString()}\n` +
                        `Time: ${startTime} - ${endTime}\n` +
                        `Class: ${className}, Section: ${sectionName}`;
                    break;

                default:
                    title = `Exam Notification - ${examType?.toUpperCase() || 'Exam'}`;
                    message = `Exam: ${subjectName}\n` +
                        `Date: ${examDateObj.toDateString()}\n` +
                        `Time: ${startTime} - ${endTime}`;
            }

            return { title, message };
        };

        const getTeacherExamTitle = (subjectName, type) => {
            const prefixes = {
                create: 'Exam Assigned',
                update: 'Exam Updated',
                cancel: 'Exam Cancelled',
                default: 'Exam Notification'
            };
            const prefix = prefixes[type] || prefixes.default;
            return `${prefix} - ${subjectName}`;
        };

        const { title, message } = getExamNotificationContent(
            examData,
            classSection.class,
            sectionName,
            notificationType
        );

        const notifications = {};

        // Send to teacher if provided
        if (teacherId && notificationType !== 'cancel') {
            notifications.teacherNotice = await sendNotification({
                schoolId,
                title: getTeacherExamTitle(examData.subjectName, notificationType),
                message,
                createdBy,
                target: 'selected_teachers',
                targetTeacherIds: [teacherId],
                category: 'notice', // Using 'notice' since 'exam' is not in schema enum
                pinned: true,
                attachments: examData.attachments || [],
                startDate: examData.examDate,
                endDate: examData.examDate
            });
        }

        // Send to class/section
        notifications.classNotice = await sendNotification({
            schoolId,
            title,
            message,
            createdBy,
            target: 'class',
            classId,
            sectionId,
            category: 'notice', // Using 'notice' since 'exam' is not in schema enum
            pinned: true,
            attachments: examData.attachments || [],
            startDate: examData.examDate,
            endDate: examData.examDate
        });

        return notifications;

    } catch (error) {
        console.error('Error sending exam notification:', error);
        return null;
    }
};

// Bulk notifications
const sendBulkNotifications = async ({ schoolId, title, message, createdBy, targetUserIds, category = 'general', pinned = false, attachments = [] }) => {
    try {
        if (!targetUserIds || targetUserIds.length === 0) {
            console.error('No target users specified');
            return null;
        }

        return await sendNotification({
            schoolId,
            title,
            message,
            createdBy,
            targetUserIds,
            category,
            pinned,
            attachments,
            startDate: new Date()
        });

    } catch (error) {
        console.error('Error sending bulk notifications:', error);
        return null;
    }
};

// Mark notification as read
const markNotificationAsRead = async (notificationId, userId) => {
    try {
        await Notice.findByIdAndUpdate(
            notificationId,
            {
                $addToSet: {
                    readBy: {
                        user: userId,
                        readAt: new Date()
                    }
                }
            }
        );
        return true;
    } catch (error) {
        console.error('Error marking notification as read:', error);
        return false;
    }
};

// Get user notifications (updated for schema compatibility)
const getUserNotifications = async (userId, schoolId, options = {}) => {
    try {
        const {
            limit = 50,
            skip = 0,
            unreadOnly = false,
            category = null,
            startDate = null,
            endDate = null
        } = options;

        // First get user role
        const user = await User.findById(userId).select('role');
        if (!user) return [];

        const userRole = user.role;
        const userObjectId = mongoose.Types.ObjectId(userId);

        // Base query
        let query = {
            school: schoolId,
            $or: []
        };

        // Add conditions based on user role
        if (userRole === 'teacher') {
            query.$or = [
                { target: 'all_teachers' },
                { target: 'all' },
                { target: 'custom' },
                { target: 'selected_teachers', targetTeacherIds: { $in: [userId] } }
            ];
        } else if (userRole === 'student') {
            query.$or = [
                { target: 'all_students' },
                { target: 'all' },
                { target: 'custom' },
                { target: 'selected_students', targetStudentIds: { $in: [userId] } },
                { target: 'class' } // Students in specific class will need additional filtering
            ];
        } else {
            // For admins or other roles
            query.$or = [
                { target: 'all' },
                { target: 'custom' }
            ];
        }

        if (unreadOnly) {
            query['readBy.user'] = { $ne: userId };
        }

        if (category) {
            query.category = category;
        }

        if (startDate) {
            query.createdAt = { $gte: new Date(startDate) };
        }

        if (endDate) {
            query.createdAt = { ...query.createdAt, $lte: new Date(endDate) };
        }

        let notifications = await Notice.find(query)
            .sort({ pinned: -1, createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .populate('createdBy', 'name email')
            .populate('targetTeacherIds', 'name email')
            .populate('targetStudentIds', 'name email')
            .populate('classId', 'class')
            .lean();

        // Filter class notifications for students
        if (userRole === 'student') {
            // You'll need to implement logic to check if student belongs to the class
            // This might require additional queries to ClassSection model
            notifications = notifications.filter(notice => {
                if (notice.target === 'class') {
                    // Check if student is in this class/section
                    // You'll need to implement this based on your student-class relationship
                    return true; // Placeholder
                }
                return true;
            });
        }

        return notifications;

    } catch (error) {
        console.error('Error getting user notifications:', error);
        return [];
    }
};

// Get unread notification count
const getUnreadNotificationCount = async (userId, schoolId) => {
    try {
        const user = await User.findById(userId).select('role');
        if (!user) return 0;

        const userRole = user.role;

        let query = {
            school: schoolId,
            'readBy.user': { $ne: userId },
            $or: []
        };

        if (userRole === 'teacher') {
            query.$or = [
                { target: 'all_teachers' },
                { target: 'all' },
                { target: 'custom' },
                { target: 'selected_teachers', targetTeacherIds: { $in: [userId] } }
            ];
        } else if (userRole === 'student') {
            query.$or = [
                { target: 'all_students' },
                { target: 'all' },
                { target: 'custom' },
                { target: 'selected_students', targetStudentIds: { $in: [userId] } }
            ];
        } else {
            query.$or = [
                { target: 'all' },
                { target: 'custom' }
            ];
        }

        return await Notice.countDocuments(query);
    } catch (error) {
        console.error('Error getting unread count:', error);
        return 0;
    }
};

// Delete notification
const deleteNotification = async (notificationId, userId) => {
    try {
        const notification = await Notice.findById(notificationId);
        if (!notification) {
            console.error('Notification not found');
            return false;
        }

        // Optional: Check if user has permission to delete (e.g., creator or admin)
        if (notification.createdBy.toString() !== userId.toString()) {
            console.error('User not authorized to delete this notification');
            return false;
        }

        await Notice.findByIdAndDelete(notificationId);
        return true;
    } catch (error) {
        console.error('Error deleting notification:', error);
        return false;
    }
};

// Export all functions
module.exports = {
    sendProfileUpdateNotification,
    sendEmailChangeNotification,
    sendBulkEmployeeNotifications,
    sendExamNotification,
    sendBulkNotifications,
    markNotificationAsRead,
    getUserNotifications,
    getUnreadNotificationCount,
    deleteNotification
};