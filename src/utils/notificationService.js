// const Notice = require("../models/Notice");
// const User = require("../models/User");
// const ClassSection = require("../models/ClassSection");
// const School = require("../models/School");

// const formatDate = (date) => {
//     if (!date) return null;
//     return typeof date === 'string' ? date : date.toISOString().split('T')[0];
// };

// // Notification types enum
// const NOTIFICATION_TYPES = {
//     PROFILE_UPDATE: 'profile_update',
//     EMAIL_CHANGE: 'email_change',
//     RESULT: 'result',
//     DIARY: 'diary',
//     DOCUMENT: 'document',
//     LEAVE: 'leave',
//     ATTENDANCE: 'attendance',
//     FEE: 'fee',
//     EXAM: 'exam',
//     HOMEWORK: 'homework',
//     EVENT: 'event',
//     CUSTOM: 'custom'
// };

// // Notification categories (aligned with Notice model)
// const NOTIFICATION_CATEGORIES = {
//     NOTICE: 'notice',
//     MEETING: 'meeting',
//     HOLIDAY: 'holiday',
//     GENERAL: 'general'
// };

// // Notification targets (aligned with Notice model)
// const NOTIFICATION_TARGETS = {
//     ALL_TEACHERS: 'all_teachers',
//     SELECTED_TEACHERS: 'selected_teachers',
//     ALL_STUDENTS: 'all_students',
//     SELECTED_STUDENTS: 'selected_students',
//     ALL: 'all',
//     CUSTOM: 'custom',
//     CLASS: 'class',
//     ADMIN: 'admin'
// };

// const createNotification = async (params) => {
//     try {
//         console.log('========== CREATE NOTIFICATION START ==========');
//         console.log('createNotification called with params:', {
//             type: params.type,
//             actor: params.actor?._id,
//             actorName: params.actor?.name,
//             actorRole: params.actor?.role,
//             target: params.target,
//             targetAdmins: params.targetAdmins?.length,
//             targetTeachers: params.targetTeachers?.length,
//             targetStudents: params.targetStudents?.length,
//             targetUsers: params.targetUsers?.length,
//             title: params.title
//         });

//         const {
//             type = NOTIFICATION_TYPES.CUSTOM,
//             actor,
//             targetUsers = [],
//             targetTeachers = [],
//             targetStudents = [],
//             targetAdmins = [],
//             school,
//             classId,
//             sectionId,
//             title,
//             message,
//             changes = [],
//             data = {},
//             category = NOTIFICATION_CATEGORIES.GENERAL,
//             pinned = false,
//             target: explicitTarget
//         } = params;

//         // Validate required parameters
//         if (!actor || !actor._id) {
//             console.error('Missing actor parameter for notification');
//             return null;
//         }

//         // Extract school ID from various possible formats
//         let schoolId;
//         if (typeof school === 'string' || school instanceof String) {
//             schoolId = school;
//         } else if (school && school._id) {
//             schoolId = school._id;
//         } else if (school && school.id) {
//             schoolId = school.id;
//         } else if (actor.school) {
//             schoolId = actor.school;
//         } else {
//             console.error('Missing school parameter for notification');
//             return null;
//         }

//         console.log('School ID for notification:', schoolId);

//         // Use explicit target if provided, otherwise determine based on arrays
//         let target = explicitTarget || NOTIFICATION_TARGETS.CUSTOM;
//         let finalTargetAdmins = [];
//         let finalTargetTeachers = [];
//         let finalTargetStudents = [];

//         console.log('Initial arrays:', {
//             targetAdmins: targetAdmins.length,
//             targetTeachers: targetTeachers.length,
//             targetStudents: targetStudents.length,
//             targetUsers: targetUsers.length
//         });

//         // If explicit target is set, use the corresponding array
//         if (explicitTarget) {
//             console.log('Using explicit target:', explicitTarget);

//             switch (explicitTarget) {
//                 case NOTIFICATION_TARGETS.ADMIN:
//                     finalTargetAdmins = targetAdmins.length > 0 ? targetAdmins : targetUsers;
//                     break;
//                 case NOTIFICATION_TARGETS.SELECTED_TEACHERS:
//                     finalTargetTeachers = targetTeachers.length > 0 ? targetTeachers : targetUsers;
//                     break;
//                 case NOTIFICATION_TARGETS.SELECTED_STUDENTS:
//                     finalTargetStudents = targetStudents.length > 0 ? targetStudents : targetUsers;
//                     break;
//             }
//         } else {
//             // Auto-detect based on which array has data
//             if (targetAdmins.length > 0) {
//                 target = NOTIFICATION_TARGETS.ADMIN;
//                 finalTargetAdmins = targetAdmins;
//                 console.log('Setting target to ADMIN based on targetAdmins');
//             } else if (targetTeachers.length > 0) {
//                 target = NOTIFICATION_TARGETS.SELECTED_TEACHERS;
//                 finalTargetTeachers = targetTeachers;
//                 console.log('Setting target to SELECTED_TEACHERS based on targetTeachers');
//             } else if (targetStudents.length > 0) {
//                 target = NOTIFICATION_TARGETS.SELECTED_STUDENTS;
//                 finalTargetStudents = targetStudents;
//                 console.log('Setting target to SELECTED_STUDENTS based on targetStudents');
//             } else if (targetUsers.length > 0) {
//                 console.log('targetUsers provided, determining roles...');
//                 // Determine user roles
//                 try {
//                     const users = await User.find({ _id: { $in: targetUsers } }).select('role');
//                     console.log('Found users:', users.length);

//                     const admins = users.filter(u => ['admin_office', 'superadmin', 'school'].includes(u.role)).map(u => u._id);
//                     const teachers = users.filter(u => u.role === 'teacher').map(u => u._id);
//                     const students = users.filter(u => u.role === 'student').map(u => u._id);

//                     console.log('Role distribution:', {
//                         admins: admins.length,
//                         teachers: teachers.length,
//                         students: students.length
//                     });

//                     if (admins.length > 0) {
//                         target = NOTIFICATION_TARGETS.ADMIN;
//                         finalTargetAdmins = admins;
//                         console.log('Setting target to ADMIN based on user roles');
//                     } else if (teachers.length > 0) {
//                         target = NOTIFICATION_TARGETS.SELECTED_TEACHERS;
//                         finalTargetTeachers = teachers;
//                         console.log('Setting target to SELECTED_TEACHERS based on user roles');
//                     } else if (students.length > 0) {
//                         target = NOTIFICATION_TARGETS.SELECTED_STUDENTS;
//                         finalTargetStudents = students;
//                         console.log('Setting target to SELECTED_STUDENTS based on user roles');
//                     }
//                 } catch (error) {
//                     console.error('Error determining user roles:', error);
//                 }
//             } else {
//                 console.log('No target arrays provided, using CUSTOM target');
//             }
//         }

//         console.log('Final target determination:', {
//             target: target,
//             adminCount: finalTargetAdmins.length,
//             teacherCount: finalTargetTeachers.length,
//             studentCount: finalTargetStudents.length
//         });

//         // Get default title and message
//         const notificationTitle = title || getDefaultTitle(type, data);
//         const notificationMessage = message || getDefaultMessage(type, data, changes, actor);

//         console.log('Notification content:', {
//             title: notificationTitle,
//             messagePreview: notificationMessage.substring(0, 100) + '...'
//         });

//         // Prepare notification data
//         const notificationData = {
//             school: schoolId,
//             title: notificationTitle,
//             message: notificationMessage,
//             createdBy: actor._id,
//             target: target,
//             category: category,
//             startDate: formatDate(new Date()),
//             pinned: pinned,
//             readBy: []
//         };

//         // Add target-specific arrays based on target type
//         if (target === NOTIFICATION_TARGETS.ADMIN && finalTargetAdmins.length > 0) {
//             notificationData.targetAdminIds = finalTargetAdmins;
//             console.log('Added targetAdminIds:', finalTargetAdmins.length);
//         } else if (target === NOTIFICATION_TARGETS.SELECTED_TEACHERS && finalTargetTeachers.length > 0) {
//             notificationData.targetTeacherIds = finalTargetTeachers;
//             console.log('Added targetTeacherIds:', finalTargetTeachers.length);
//         } else if (target === NOTIFICATION_TARGETS.SELECTED_STUDENTS && finalTargetStudents.length > 0) {
//             notificationData.targetStudentIds = finalTargetStudents;
//             console.log('Added targetStudentIds:', finalTargetStudents.length);
//         } else if (target === NOTIFICATION_TARGETS.CLASS && classId) {
//             notificationData.classId = classId;
//             if (sectionId) {
//                 notificationData.sectionId = sectionId;
//             }
//             console.log('Added class/section:', classId, sectionId);
//         }

//         console.log('Notification data before save:', {
//             school: notificationData.school,
//             target: notificationData.target,
//             targetAdminIds: notificationData.targetAdminIds?.length || 0,
//             targetTeacherIds: notificationData.targetTeacherIds?.length || 0,
//             targetStudentIds: notificationData.targetStudentIds?.length || 0
//         });

//         const notification = await Notice.create(notificationData);

//         console.log('Notification created successfully:', notification._id);
//         console.log('========== CREATE NOTIFICATION END ==========');
//         return notification;

//     } catch (error) {
//         console.error('Error creating notification:', error);
//         console.error('Error details:', error.message);
//         return null;
//     }
// };
// /**
//  * Get default title based on notification type
//  */
// const getDefaultTitle = (type, data) => {
//     const titles = {
//         [NOTIFICATION_TYPES.PROFILE_UPDATE]: 'Profile Updated',
//         [NOTIFICATION_TYPES.EMAIL_CHANGE]: 'Email Address Updated',
//         [NOTIFICATION_TYPES.RESULT]: data.resultType === 'creation' ? 'New Result Published' : 'Result Updated',
//         [NOTIFICATION_TYPES.DIARY]: data.diaryType === 'creation' ? 'New Diary Assignment' : 'Diary Updated',
//         [NOTIFICATION_TYPES.DOCUMENT]: data.documentType === 'request' ? 'Document Request' : 'Document Uploaded',
//         [NOTIFICATION_TYPES.LEAVE]: data.leaveType === 'application' ? 'Leave Application' : 'Leave Status Updated',
//         [NOTIFICATION_TYPES.ATTENDANCE]: 'Attendance Update',
//         [NOTIFICATION_TYPES.FEE]: 'Fee Update',
//         [NOTIFICATION_TYPES.EXAM]: 'Exam Schedule Update',
//         [NOTIFICATION_TYPES.HOMEWORK]: 'New Homework',
//         [NOTIFICATION_TYPES.EVENT]: 'New Event',
//         [NOTIFICATION_TYPES.CUSTOM]: 'New Notification'
//     };

//     return titles[type] || titles[NOTIFICATION_TYPES.CUSTOM];
// };

// /**
//  * Get default message based on notification type
//  */
// const getDefaultMessage = (type, data, changes, actor) => {
//     let message = '';

//     switch (type) {
//         case NOTIFICATION_TYPES.PROFILE_UPDATE:
//             message = `Your profile has been updated`;
//             if (changes && changes.length > 0) {
//                 changes.forEach((change, index) => {
//                     message += `${index + 1}. ${change}\n`;
//                 });
//             }
//             break;

//         case NOTIFICATION_TYPES.EMAIL_CHANGE:
//             message = `Your email address has been updated.\n`;
//             message += `Old Email: ${data.oldEmail || 'N/A'}\n`;
//             message += `New Email: ${data.newEmail || 'N/A'}`;
//             break;

//         case NOTIFICATION_TYPES.RESULT:
//             const resultAction = data.resultType === 'creation' ? 'added' : 'updated';
//             message = `Your ${data.examType || 'exam'} result has been ${resultAction} by ${actor.name}.`;
//             break;

//         case NOTIFICATION_TYPES.DIARY:
//             const diaryAction = data.diaryType === 'creation' ? 'assigned' : 'updated';
//             message = `A new diary has been ${diaryAction} by ${actor.name}.\n`;
//             if (data.dueDate) {
//                 message += `Due Date: ${formatDate(data.dueDate)}`;
//             }
//             break;

//         case NOTIFICATION_TYPES.DOCUMENT:
//             if (data.documentType === 'request') {
//                 message = `A document request has been made by ${actor.name}.\n`;
//                 if (data.dueDate) {
//                     message += `Due Date: ${formatDate(data.dueDate)}`;
//                 }
//             } else {
//                 message = `A document has been uploaded by ${actor.name}.\n`;
//                 message += `Request: ${data.requestTitle || 'Document Upload'}`;
//             }
//             break;

//         case NOTIFICATION_TYPES.LEAVE:
//             if (data.leaveType === 'application') {
//                 message = `A leave application has been submitted by ${actor.name}.\n`;
//             } else {
//                 message = `Your leave application status has been updated to "${data.status || 'updated'}" by ${actor.name}.`;
//             }
//             break;

//         default:
//             message = `You have a new notification from ${actor.name}.`;
//     }

//     return message;
// };

// /**
//  * Helper function to get users from class/section
//  */
// const getUsersFromClassSection = async (classId, sectionId, schoolId, roles = ['student']) => {
//     try {
//         const query = {
//             school: schoolId,
//             'classInfo.id': classId,
//             role: { $in: roles }
//         };

//         if (sectionId) {
//             query['sectionInfo.id'] = sectionId;
//         }

//         const users = await User.find(query).select('_id role name');
//         return users;
//     } catch (error) {
//         console.error('Error getting users from class/section:', error);
//         return [];
//     }
// };

// /**
//  * Send profile update notification (for backward compatibility)
//  */
// const sendProfileUpdateNotification = async ({ user, updatedBy, changes = [], updateType = 'employee' }) => {
//     return createNotification({
//         type: NOTIFICATION_TYPES.PROFILE_UPDATE,
//         actor: updatedBy,
//         targetUsers: [user._id],
//         school: user.school,
//         changes,
//         data: { updateType }
//     });
// };

// /**
//  * Send email change notification (for backward compatibility)
//  */
// const sendEmailChangeNotification = async ({ user, oldEmail, newEmail, updatedBy }) => {
//     return createNotification({
//         type: NOTIFICATION_TYPES.EMAIL_CHANGE,
//         actor: updatedBy,
//         targetUsers: [user._id],
//         school: user.school,
//         data: { oldEmail, newEmail }
//     });
// };

// /**
//  * Send bulk notifications (for backward compatibility)
//  */
// const sendBulkEmployeeNotifications = async ({ users, updatedBy, changes = [], notificationType = NOTIFICATION_TYPES.PROFILE_UPDATE, emailData = null }) => {
//     try {
//         if (!users || !Array.isArray(users) || users.length === 0) {
//             console.error('No users specified for bulk notification');
//             return [];
//         }

//         const notifications = [];
//         const userGroups = {};

//         // Group users by role for efficient notification
//         users.forEach(user => {
//             if (!userGroups[user.role]) {
//                 userGroups[user.role] = [];
//             }
//             userGroups[user.role].push(user);
//         });

//         // Create notifications for each group
//         for (const [role, roleUsers] of Object.entries(userGroups)) {
//             for (const user of roleUsers) {
//                 let notification;

//                 if (notificationType === NOTIFICATION_TYPES.PROFILE_UPDATE) {
//                     notification = await createNotification({
//                         type: NOTIFICATION_TYPES.PROFILE_UPDATE,
//                         actor: updatedBy,
//                         targetUsers: [user._id],
//                         school: user.school,
//                         changes,
//                         data: { updateType: role }
//                     });
//                 } else if (notificationType === NOTIFICATION_TYPES.EMAIL_CHANGE && emailData) {
//                     notification = await createNotification({
//                         type: NOTIFICATION_TYPES.EMAIL_CHANGE,
//                         actor: updatedBy,
//                         targetUsers: [user._id],
//                         school: user.school,
//                         data: {
//                             oldEmail: emailData.oldEmail,
//                             newEmail: emailData.newEmail
//                         }
//                     });
//                 }

//                 if (notification) notifications.push(notification);
//             }
//         }

//         console.log(`Bulk notifications sent: ${notifications.length} total`);
//         return notifications;

//     } catch (error) {
//         console.error('Error sending bulk notifications:', error);
//         return [];
//     }
// };

// /**
//  * Create result notification
//  */
// const sendResultNotification = async ({ result, actor, action = 'creation' }) => {
//     try {
//         // Get student information
//         const student = await User.findById(result.studentId).select('name classInfo sectionInfo school');

//         if (!student) {
//             console.error('Student not found for result notification');
//             return null;
//         }

//         return createNotification({
//             type: NOTIFICATION_TYPES.RESULT,
//             actor,
//             targetUsers: [result.studentId],
//             school: result.school || student.school,
//             classId: result.classId || student.classInfo?.id,
//             sectionId: result.sectionId || student.sectionInfo?.id,
//             data: {
//                 resultType: action,
//                 examType: result.examType,
//                 marks: {
//                     marksObtained: result.marksObtained,
//                     totalMarks: result.totalMarks,
//                     percentage: result.percentage,
//                     position: result.position
//                 }
//             }
//         });
//     } catch (error) {
//         console.error('Error sending result notification:', error);
//         return null;
//     }
// };

// /**
//  * Create diary notification
//  */
// const sendDiaryNotification = async ({ diary, actor, action = 'creation', targetStudentIds = [] }) => {
//     try {
//         // If targetStudentIds is provided, use it, otherwise get all students from class/section
//         let finalTargetStudents = targetStudentIds;

//         if (finalTargetStudents.length === 0 && diary.forAll) {
//             const students = await getUsersFromClassSection(
//                 diary.classId,
//                 diary.sectionId,
//                 diary.school,
//                 ['student']
//             );
//             finalTargetStudents = students.map(s => s._id);
//         }

//         // Get subject name if available
//         const subjectName = diary.subjectId?.name || 'Subject';

//         return createNotification({
//             type: NOTIFICATION_TYPES.DIARY,
//             actor,
//             targetStudents: finalTargetStudents,
//             school: diary.school,
//             classId: diary.classId,
//             sectionId: diary.sectionId,
//             data: {
//                 diaryType: action,
//                 diaryTitle: diary.title,
//                 subjectName,
//                 dueDate: diary.dueDate
//             },
//             pinned: true // Diary notifications are usually important
//         });
//     } catch (error) {
//         console.error('Error sending diary notification:', error);
//         return null;
//     }
// };


// const sendDocumentRequestNotification = async ({ documentRequest, actor, targetType = 'student' }) => {
//     try {

//         // Get student details for the message
//         const student = await User.findById(documentRequest.studentId).select('name');

//         // Build notification message
//         const message = `Document request "${documentRequest.title}" has been created by ${actor.name}.`;

//         // Determine school ID from various sources
//         let schoolId = documentRequest.school;

//         // If school is not on documentRequest, try to get it from student or actor
//         if (!schoolId) {
//             if (student && student.school) {
//                 schoolId = student.school;
//             } else if (actor && actor.school) {
//                 schoolId = actor.school;
//             }
//         }

//         console.log('School ID determined:', schoolId);

//         // ALWAYS notify student when document request is created
//         // (regardless of who creates it - teacher, admin, or school)
//         console.log('Creating student notification for student:', documentRequest.studentId);

//         const notification = await createNotification({
//             type: NOTIFICATION_TYPES.DOCUMENT,
//             actor: actor,
//             school: schoolId,
//             targetStudents: [documentRequest.studentId],
//             target: NOTIFICATION_TARGETS.SELECTED_STUDENTS,
//             classId: documentRequest.classId,
//             sectionId: documentRequest.sectionId,
//             title: 'New Document Request',
//             message: message,
//             data: {
//                 documentType: 'request',
//                 requestId: documentRequest._id,
//                 requestType: documentRequest.requestType,
//                 dueDate: documentRequest.dueDate
//             },
//             category: NOTIFICATION_CATEGORIES.GENERAL,
//             pinned: false
//         });

//         console.log('Student notification created:', notification ? 'Yes' : 'No');
//         return notification;

//     } catch (error) {
//         console.error('Error sending document request notification:', error);
//         return null;
//     }
// };

// /**
//  * Create document upload notification
//  */
// const sendDocumentUploadNotification = async ({ studentDocument, actor }) => {
//     try {
//         console.log('Document Upload Notification Debug:', {
//             actorRole: actor.role,
//             actorName: actor.name,
//             studentDocumentId: studentDocument._id,
//             requestedBy: studentDocument.requestedBy,
//             requestedByModel: studentDocument.requestedByModel,
//             uploadedFor: studentDocument.uploadedFor,
//             school: studentDocument.school
//         });

//         let requester = null;
//         let requesterRole = null;
//         let schoolId = studentDocument.school;

//         // Get requester information based on requestedByModel
//         if (studentDocument.requestedByModel === 'User') {
//             requester = await User.findById(studentDocument.requestedBy)
//                 .select('name role school _id');
//             if (requester) {
//                 requesterRole = requester.role;
//                 // If schoolId is not in studentDocument, try to get it from requester
//                 if (!schoolId && requester.school) {
//                     schoolId = requester.school;
//                 }
//             }
//         } else if (studentDocument.requestedByModel === 'School') {
//             // Requester is a School, not a User
//             const school = await School.findById(studentDocument.requestedBy)
//                 .select('name email schoolId');
//             if (school) {
//                 requester = {
//                     _id: school._id,
//                     name: school.name,
//                     role: 'school'
//                 };
//                 requesterRole = 'school';
//                 // If schoolId is not in studentDocument, use the school's ID
//                 if (!schoolId) {
//                     schoolId = school._id;
//                 }
//             }
//         }

//         if (!requester) {
//             console.error('Requester not found for document upload notification');
//             return null;
//         }

//         console.log('Requester information:', {
//             id: requester._id,
//             name: requester.name,
//             role: requesterRole,
//             model: studentDocument.requestedByModel
//         });

//         // Get student information for message
//         const student = await User.findById(studentDocument.studentId).select('name');

//         // Build message
//         const message = `Document "${studentDocument.text || 'Untitled'}" has been uploaded by ${actor.name}.\n\n` +
//             `Student: ${student?.name || 'Unknown'}\n` +
//             `Request: ${studentDocument.requestDetails || 'No details provided'}`;

//         console.log('Actor role:', actor.role, 'Requester role:', requesterRole);

//         // Case 1: Student uploaded document (most common case)
//         if (actor.role === 'student') {
//             console.log('Student uploaded document - checking requester role');

//             if (requesterRole === 'teacher') {
//                 // Student uploaded, teacher requested - notify the teacher
//                 console.log('Notifying teacher:', requester._id);
//                 return createNotification({
//                     type: NOTIFICATION_TYPES.DOCUMENT,
//                     actor: actor,
//                     school: schoolId,
//                     targetTeachers: [requester._id],
//                     target: NOTIFICATION_TARGETS.SELECTED_TEACHERS,
//                     title: 'Document Uploaded by Student',
//                     message: message,
//                     data: {
//                         documentType: 'upload',
//                         requestTitle: studentDocument.requestDetails,
//                         documentId: studentDocument._id,
//                         uploadedBy: 'student'
//                     },
//                     category: NOTIFICATION_CATEGORIES.GENERAL,
//                     pinned: false
//                 });
//             } else if (requesterRole === 'admin_office' || requesterRole === 'superadmin' || requesterRole === 'school') {
//                 // Student uploaded, admin/school requested - notify all admins
//                 console.log('Notifying all admins for school:', schoolId);
//                 const adminUsers = await User.find({
//                     school: schoolId,
//                     role: { $in: ['admin_office', 'superadmin'] }
//                 }).select('_id');

//                 console.log('Admin users found:', adminUsers.length);

//                 return createNotification({
//                     type: NOTIFICATION_TYPES.DOCUMENT,
//                     actor: actor,
//                     school: schoolId,
//                     targetAdmins: adminUsers.map(u => u._id),
//                     target: NOTIFICATION_TARGETS.ADMIN,
//                     title: 'Document Uploaded by Student',
//                     message: message,
//                     data: {
//                         documentType: 'upload',
//                         requestTitle: studentDocument.requestDetails,
//                         documentId: studentDocument._id,
//                         uploadedBy: 'student'
//                     },
//                     category: NOTIFICATION_CATEGORIES.GENERAL,
//                     pinned: false
//                 });
//             }
//         }
//         // Case 2: Teacher uploaded document
//         else if (actor.role === 'teacher') {
//             console.log('Teacher uploaded document');

//             // Teacher uploaded - notify the original requester
//             if (requesterRole === 'teacher') {
//                 // Notify teacher
//                 return createNotification({
//                     type: NOTIFICATION_TYPES.DOCUMENT,
//                     actor: actor,
//                     school: schoolId,
//                     targetTeachers: [requester._id],
//                     target: NOTIFICATION_TARGETS.SELECTED_TEACHERS,
//                     title: 'Document Uploaded by Teacher',
//                     message: message,
//                     data: {
//                         documentType: 'upload',
//                         requestTitle: studentDocument.requestDetails,
//                         documentId: studentDocument._id,
//                         uploadedBy: 'teacher'
//                     },
//                     category: NOTIFICATION_CATEGORIES.GENERAL,
//                     pinned: false
//                 });
//             } else if (requesterRole === 'admin_office' || requesterRole === 'superadmin' || requesterRole === 'school') {
//                 // Notify all admins
//                 const adminUsers = await User.find({
//                     school: schoolId,
//                     role: { $in: ['admin_office', 'superadmin'] }
//                 }).select('_id');

//                 return createNotification({
//                     type: NOTIFICATION_TYPES.DOCUMENT,
//                     actor: actor,
//                     school: schoolId,
//                     targetAdmins: adminUsers.map(u => u._id),
//                     target: NOTIFICATION_TARGETS.ADMIN,
//                     title: 'Document Uploaded by Teacher',
//                     message: message,
//                     data: {
//                         documentType: 'upload',
//                         requestTitle: studentDocument.requestDetails,
//                         documentId: studentDocument._id,
//                         uploadedBy: 'teacher'
//                     },
//                     category: NOTIFICATION_CATEGORIES.GENERAL,
//                     pinned: false
//                 });
//             }
//         }
//         // Case 3: School/Admin uploaded document
//         else if (actor.role === 'school' || actor.role === 'admin_office' || actor.role === 'superadmin' || !actor.role) {
//             console.log('Admin/School uploaded document');

//             // Admin uploaded - notify all admins
//             const adminUsers = await User.find({
//                 school: schoolId,
//                 role: { $in: ['admin_office', 'superadmin'] }
//             }).select('_id');

//             return createNotification({
//                 type: NOTIFICATION_TYPES.DOCUMENT,
//                 actor: actor,
//                 school: schoolId,
//                 targetAdmins: adminUsers.map(u => u._id),
//                 target: NOTIFICATION_TARGETS.ADMIN,
//                 title: 'Document Uploaded',
//                 message: message,
//                 data: {
//                     documentType: 'upload',
//                     requestTitle: studentDocument.requestDetails,
//                     documentId: studentDocument._id,
//                     uploadedBy: 'admin'
//                 },
//                 category: NOTIFICATION_CATEGORIES.GENERAL,
//                 pinned: false
//             });
//         }

//         console.log('No notification created - unknown uploader type or requester role');
//         return null;

//     } catch (error) {
//         console.error('Error sending document upload notification:', error);
//         console.error('Error stack:', error.stack);
//         return null;
//     }
// };

// const sendStudentLeaveNotification = async ({ leave, actor, action = 'create' }) => {
//     try {
//         if (leave.userType === 'teacher') {
//             return sendTeacherLeaveNotification({ leave, actor, action });
//         }

//         const adminUsers = await User.find({
//             school: leave.school,
//             role: { $in: ['admin_office', 'superadmin', 'school'] }
//         }).select('_id');

//         if (action === 'create' || action === 'update' || action === 'cancel') {
//             return createNotification({
//                 type: NOTIFICATION_TYPES.LEAVE,
//                 actor,
//                 school: leave.school,
//                 targetAdmins: adminUsers.map(u => u._id),
//                 target: NOTIFICATION_TARGETS.ADMIN,
//                 title: `Student Leave ${getActionText(action)}`,
//                 message: getStudentLeaveMessage(leave, actor, action),
//                 data: {
//                     leaveType: 'student',
//                     action: action,
//                     leaveId: leave._id,
//                     studentName: leave.studentName,
//                     dates: leave.dates,
//                     status: leave.status
//                 },
//                 category: NOTIFICATION_CATEGORIES.GENERAL,
//                 pinned: false
//             });
//         } else if (action === 'approve' || action === 'reject') {
//             return createNotification({
//                 type: NOTIFICATION_TYPES.LEAVE,
//                 actor,
//                 school: leave.school,
//                 targetStudents: [leave.studentId],
//                 target: NOTIFICATION_TARGETS.SELECTED_STUDENTS,
//                 title: `Leave ${action === 'approve' ? 'Approved' : 'Rejected'}`,
//                 message: getStudentLeaveMessage(leave, actor, action),
//                 data: {
//                     leaveType: 'student',
//                     action: action,
//                     leaveId: leave._id,
//                     dates: leave.dates,
//                     status: leave.status,
//                     remark: leave.remark
//                 },
//                 category: NOTIFICATION_CATEGORIES.GENERAL,
//                 pinned: false
//             });
//         }
//     } catch (error) {
//         console.error('Error sending student leave notification:', error);
//         return null;
//     }
// };


// //  Send notification for teacher leave application
// const sendTeacherLeaveNotification = async ({ leave, actor, action = 'create' }) => {
//     try {
//         const adminUsers = await User.find({
//             school: leave.school,
//             role: { $in: ['admin_office', 'superadmin', 'school'] }
//         }).select('_id');

//         if (action === 'create' || action === 'update' || action === 'cancel') {
//             return createNotification({
//                 type: NOTIFICATION_TYPES.LEAVE,
//                 actor,
//                 school: leave.school,
//                 targetAdmins: adminUsers.map(u => u._id),
//                 target: NOTIFICATION_TARGETS.ADMIN,
//                 title: `Teacher Leave ${getActionText(action)}`,
//                 message: getTeacherLeaveMessage(leave, actor, action),
//                 data: {
//                     leaveType: 'teacher',
//                     action: action,
//                     leaveId: leave._id,
//                     teacherName: leave.teacherName,
//                     dates: leave.dates,
//                     status: leave.status
//                 },
//                 category: NOTIFICATION_CATEGORIES.GENERAL,
//                 pinned: false
//             });
//         } else if (action === 'approve' || action === 'reject') {
//             return createNotification({
//                 type: NOTIFICATION_TYPES.LEAVE,
//                 actor,
//                 school: leave.school,
//                 targetTeachers: [leave.teacherId],
//                 target: NOTIFICATION_TARGETS.SELECTED_TEACHERS,
//                 title: `Leave ${action === 'approve' ? 'Approved' : 'Rejected'}`,
//                 message: getTeacherLeaveMessage(leave, actor, action),
//                 data: {
//                     leaveType: 'teacher',
//                     action: action,
//                     leaveId: leave._id,
//                     dates: leave.dates,
//                     status: leave.status,
//                     remark: leave.remark
//                 },
//                 category: NOTIFICATION_CATEGORIES.GENERAL,
//                 pinned: false
//             });
//         }
//     } catch (error) {
//         console.error('Error sending teacher leave notification:', error);
//         return null;
//     }
// };

// // Helper functions
// const getActionText = (action) => {
//     const actions = {
//         'create': 'Application',
//         'update': 'Updated',
//         'cancel': 'Cancelled',
//         'approve': 'Approved',
//         'reject': 'Rejected'
//     };
//     return actions[action] || action;
// };

// const getStudentLeaveMessage = (leave, actor, action) => {
//     let message = '';

//     switch (action) {
//         case 'create':
//             message = `Leave application submitted by ${leave.studentName}.`;
//             break;

//         case 'update':
//             message = `Leave application updated by ${leave.studentName}.`;
//             break;

//         case 'cancel':
//             message = `Leave cancelled by ${leave.studentName}.`;
//             break;

//         case 'approve':
//             message = `Your leave application has been approved by ${actor.name}.`;
//             if (leave.remark) {
//                 message += `Remark: ${leave.remark}`;
//             }
//             break;

//         case 'reject':
//             message = `Your leave application has been rejected by ${actor.name}.`;
//             if (leave.remark) {
//                 message += `Remark: ${leave.remark}`;
//             }
//             break;
//     }

//     return message;
// };

// const getTeacherLeaveMessage = (leave, actor, action) => {
//     let message = '';

//     switch (action) {
//         case 'create':
//             message = `Leave application submitted by teacher ${leave.teacherName}.`;
//             break;

//         case 'update':
//             message = `Leave application updated by teacher ${leave.teacherName}.`;
//             break;

//         case 'cancel':
//             message = `Leave cancelled by teacher ${leave.teacherName}.`;
//             break;

//         case 'approve':
//             message = `Your leave application has been approved by ${actor.name}.`;
//             break;

//         case 'reject':
//             message = `Your leave application has been rejected by ${actor.name}.`;
//             break;
//     }

//     return message;
// };


// const sendFeeNotificationToStudent = async (fee, actor, action = 'created') => {
//     try {
//         const student = await User.findById(fee.studentId).select('name email school');
//         if (!student) return null;

//         let title, message;
//         if (action === 'created') {
//             title = 'New Fee Generated';
//             message = `A new fee of ₹${fee.amount} for ${fee.month} has been generated by ${actor.name}. Title: ${fee.title}`;
//         } else if (action === 'updated') {
//             title = 'Fee Updated';
//             message = `Your fee for ${fee.month} has been updated by ${actor.name}. New amount: ₹${fee.amount}`;
//         } else if (action === 'submitted') {
//             title = 'Payment Proof Submitted';
//             message = `Payment proof for fee of ₹${fee.amount} (${fee.month}) has been submitted. Awaiting admin approval.`;
//         }

//         return createNotification({
//             type: NOTIFICATION_TYPES.FEE,
//             actor,
//             targetStudents: [fee.studentId],
//             school: fee.school,
//             title,
//             message,
//             data: {
//                 feeId: fee._id,
//                 amount: fee.amount,
//                 month: fee.month,
//                 title: fee.title,
//                 status: fee.status,
//                 action
//             },
//             category: 'general',
//             pinned: false
//         });
//     } catch (error) {
//         console.error('Error sending fee notification to student:', error);
//         return null;
//     }
// };

// // Send notification to admins when student submits proof
// const sendFeeNotificationToAdmins = async (fee, actor) => {
//     try {
//         const adminUsers = await User.find({
//             school: fee.school,
//             role: { $in: ['admin_office', 'superadmin', 'school'] }
//         }).select('_id');

//         const student = await User.findById(fee.studentId).select('name');

//         const title = 'Payment Proof Submitted';
//         const message = `Student ${student?.name || 'Unknown'} has submitted payment proof for fee of ₹${fee.amount} (${fee.month}). Please review.`;

//         return createNotification({
//             type: NOTIFICATION_TYPES.FEE,
//             actor,
//             targetAdmins: adminUsers.map(u => u._id),
//             target: NOTIFICATION_TARGETS.ADMIN,
//             school: fee.school,
//             title,
//             message,
//             data: {
//                 feeId: fee._id,
//                 studentId: fee.studentId,
//                 studentName: student?.name,
//                 amount: fee.amount,
//                 month: fee.month,
//                 title: fee.title,
//                 status: fee.status
//             },
//             category: 'general',
//             pinned: false
//         });
//     } catch (error) {
//         console.error('Error sending fee notification to admins:', error);
//         return null;
//     }
// };

// // Send notification when payment is approved/rejected
// const sendPaymentStatusNotification = async (fee, actor, status) => {
//     try {
//         const student = await User.findById(fee.studentId).select('name email school');
//         if (!student) return null;

//         const title = `Payment ${status === 'approved' ? 'Approved' : 'Rejected'}`;
//         const message = `Your payment of ₹${fee.amount} for ${fee.month} has been ${status} by ${actor.name}.`;

//         return createNotification({
//             type: NOTIFICATION_TYPES.FEE,
//             actor,
//             targetStudents: [fee.studentId],
//             school: fee.school,
//             title,
//             message,
//             data: {
//                 feeId: fee._id,
//                 amount: fee.amount,
//                 month: fee.month,
//                 title: fee.title,
//                 status: status
//             },
//             category: 'general',
//             pinned: false
//         });
//     } catch (error) {
//         console.error('Error sending payment status notification:', error);
//         return null;
//     }
// };

// module.exports = {
//     // Constants
//     NOTIFICATION_TYPES,
//     NOTIFICATION_CATEGORIES,
//     NOTIFICATION_TARGETS,

//     // Main unified function
//     createNotification,

//     // Helper functions
//     getUsersFromClassSection,

//     // Backward compatibility functions
//     sendProfileUpdateNotification,
//     sendEmailChangeNotification,
//     sendBulkEmployeeNotifications,

//     // Service-specific functions
//     sendResultNotification,
//     sendDiaryNotification,
//     sendDocumentRequestNotification,
//     sendDocumentUploadNotification,
//     sendStudentLeaveNotification,
//     sendTeacherLeaveNotification,

//     // Fee notifications
//     sendFeeNotificationToStudent,
//     sendFeeNotificationToAdmins,
//     sendPaymentStatusNotification
// };















// services/notification.service.js
const Notice = require("../models/Notice");
const Staff = require("../models/Staff");
const Student = require("../models/Student");
const School = require("../models/School");
const ClassSection = require("../models/ClassSection");

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

// Notification categories
const NOTIFICATION_CATEGORIES = {
    NOTICE: 'notice',
    MEETING: 'meeting',
    HOLIDAY: 'holiday',
    GENERAL: 'general'
};

// Notification targets
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

// Helper to get admin users from Staff and School
const getAdminUsers = async (schoolId) => {
    try {
        const adminStaff = await Staff.find({
            school: schoolId,
            role: { $in: ['admin_office', 'superadmin'] },
            isActive: true
        }).select('_id name email role');

        const school = await School.findById(schoolId).select('_id name email');

        const admins = [
            ...adminStaff.map(s => ({
                _id: s._id,
                name: s.name,
                email: s.email,
                role: s.role,
                model: 'Staff'
            }))
        ];

        if (school) {
            admins.push({
                _id: school._id,
                name: school.name,
                email: school.email,
                role: 'school',
                model: 'School'
            });
        }

        return admins;
    } catch (error) {
        console.error('Error getting admin users:', error);
        return [];
    }
};

// Helper to get users from class/section
const getUsersFromClassSection = async (classId, sectionId, schoolId, roles = ['student']) => {
    try {
        const users = [];
        
        if (roles.includes('student')) {
            const students = await Student.find({
                school: schoolId,
                'classInfo.id': classId,
                'sectionInfo.id': sectionId,
                isActive: true
            }).select('_id name email role');
            users.push(...students.map(s => ({ ...s.toObject(), model: 'Student' })));
        }
        
        if (roles.includes('teacher')) {
            const teachers = await Staff.find({
                school: schoolId,
                'classInfo.id': classId,
                'sectionInfo.id': sectionId,
                role: 'teacher',
                isActive: true
            }).select('_id name email role');
            users.push(...teachers.map(t => ({ ...t.toObject(), model: 'Staff' })));
        }
        
        return users;
    } catch (error) {
        console.error('Error getting users from class/section:', error);
        return [];
    }
};

const createNotification = async (params) => {
    try {
        const {
            type = NOTIFICATION_TYPES.CUSTOM,
            actor,
            requestedByModel,
            targetAdmins = [],
            targetTeachers = [],
            targetStudents = [],
            targetUsers = [],
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

        if (!actor || !actor._id) {
            console.error('Missing actor parameter for notification');
            return null;
        }

        let schoolId;
        if (typeof school === 'string') {
            schoolId = school;
        } else if (school && school._id) {
            schoolId = school._id;
        } else if (actor.school) {
            schoolId = actor.school;
        } else {
            console.error('Missing school parameter for notification');
            return null;
        }

        let target = explicitTarget || NOTIFICATION_TARGETS.CUSTOM;
        let finalTargetAdmins = [...targetAdmins];
        let finalTargetTeachers = [...targetTeachers];
        let finalTargetStudents = [...targetStudents];

        // Handle targetUsers by determining their roles
        if (targetUsers.length > 0 && !explicitTarget) {
            const staffUsers = await Staff.find({ _id: { $in: targetUsers } }).select('_id role');
            const studentUsers = await Student.find({ _id: { $in: targetUsers } }).select('_id role');
            
            const adminIds = staffUsers.filter(u => ['admin_office', 'superadmin'].includes(u.role)).map(u => u._id);
            const teacherIds = staffUsers.filter(u => u.role === 'teacher').map(u => u._id);
            const studentIds = studentUsers.map(u => u._id);
            
            if (adminIds.length > 0) finalTargetAdmins.push(...adminIds);
            if (teacherIds.length > 0) finalTargetTeachers.push(...teacherIds);
            if (studentIds.length > 0) finalTargetStudents.push(...studentIds);
        }

        if (!explicitTarget) {
            if (finalTargetAdmins.length > 0) {
                target = NOTIFICATION_TARGETS.ADMIN;
            } else if (finalTargetTeachers.length > 0) {
                target = NOTIFICATION_TARGETS.SELECTED_TEACHERS;
            } else if (finalTargetStudents.length > 0) {
                target = NOTIFICATION_TARGETS.SELECTED_STUDENTS;
            }
        }

        const notificationTitle = title || getDefaultTitle(type, data);
        const notificationMessage = message || getDefaultMessage(type, data, changes, actor);

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

        if (requestedByModel) {
            notificationData.requestedByModel = requestedByModel;
        }

        if (target === NOTIFICATION_TARGETS.ADMIN && finalTargetAdmins.length > 0) {
            notificationData.targetAdminIds = finalTargetAdmins;
        } else if (target === NOTIFICATION_TARGETS.SELECTED_TEACHERS && finalTargetTeachers.length > 0) {
            notificationData.targetTeacherIds = finalTargetTeachers;
        } else if (target === NOTIFICATION_TARGETS.SELECTED_STUDENTS && finalTargetStudents.length > 0) {
            notificationData.targetStudentIds = finalTargetStudents;
        } else if (target === NOTIFICATION_TARGETS.CLASS && classId) {
            notificationData.classId = classId;
            if (sectionId) notificationData.sectionId = sectionId;
        }

        const notification = await Notice.create(notificationData);
        return notification;

    } catch (error) {
        console.error('Error creating notification:', error);
        return null;
    }
};

const getDefaultTitle = (type, data) => {
    const titles = {
        [NOTIFICATION_TYPES.PROFILE_UPDATE]: 'Profile Updated',
        [NOTIFICATION_TYPES.EMAIL_CHANGE]: 'Email Address Updated',
        [NOTIFICATION_TYPES.RESULT]: data.resultType === 'creation' ? 'New Result Published' : 'Result Updated',
        [NOTIFICATION_TYPES.DIARY]: data.diaryType === 'creation' ? 'New Diary Assignment' : 'Diary Updated',
        [NOTIFICATION_TYPES.DOCUMENT]: data.documentType === 'request' ? 'Document Request' : 'Document Uploaded',
        [NOTIFICATION_TYPES.LEAVE]: data.leaveType === 'teacher' ? 'Teacher Leave Application' : 'Student Leave Application',
        [NOTIFICATION_TYPES.ATTENDANCE]: 'Attendance Update',
        [NOTIFICATION_TYPES.FEE]: 'Fee Update',
        [NOTIFICATION_TYPES.EXAM]: 'Exam Schedule Update',
        [NOTIFICATION_TYPES.HOMEWORK]: 'New Homework',
        [NOTIFICATION_TYPES.EVENT]: 'New Event',
        [NOTIFICATION_TYPES.CUSTOM]: 'New Notification'
    };
    return titles[type] || titles[NOTIFICATION_TYPES.CUSTOM];
};

const getDefaultMessage = (type, data, changes, actor) => {
    let message = '';

    switch (type) {
        case NOTIFICATION_TYPES.PROFILE_UPDATE:
            message = `Your profile has been updated`;
            if (changes && changes.length > 0) {
                changes.forEach((change, index) => {
                    message += `\n${index + 1}. ${change}`;
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
            if (data.action === 'create') {
                message = `${data.leaveType === 'teacher' ? 'Teacher' : 'Student'} ${data.studentName || data.teacherName} has applied for leave on ${data.dates?.join(', ')}.`;
            } else if (data.action === 'approve') {
                message = `Your leave application has been approved by ${actor.name}.`;
            } else if (data.action === 'reject') {
                message = `Your leave application has been rejected by ${actor.name}.`;
                if (data.remark) message += ` Reason: ${data.remark}`;
            } else if (data.action === 'cancel') {
                message = `Leave application has been cancelled by ${actor.name}.`;
            } else if (data.action === 'update') {
                message = `Leave application has been updated by ${actor.name}.`;
            }
            break;

        case NOTIFICATION_TYPES.FEE:
            if (data.action === 'created') {
                message = `A new fee of ₹${data.amount} for ${data.month} has been generated. Title: ${data.title}`;
            } else if (data.action === 'updated') {
                message = `Your fee for ${data.month} has been updated. New amount: ₹${data.amount}`;
            } else if (data.action === 'submitted') {
                message = `Payment proof for fee of ₹${data.amount} (${data.month}) has been submitted. Awaiting admin approval.`;
            } else if (data.status === 'approved') {
                message = `Your payment of ₹${data.amount} for ${data.month} has been approved.`;
            } else if (data.status === 'rejected') {
                message = `Your payment of ₹${data.amount} for ${data.month} has been rejected.`;
            }
            break;

        default:
            message = `You have a new notification from ${actor.name}.`;
    }

    return message;
};

// PROFILE UPDATE NOTIFICATION
const sendProfileUpdateNotification = async ({ user, updatedBy, changes = [], updateType = 'employee' }) => {
    let requestedByModel = 'Staff';
    let targetUser = user._id;
    let targetModel = 'Staff';
    
    if (user.role === 'student') {
        targetModel = 'Student';
    }
    
    return createNotification({
        type: NOTIFICATION_TYPES.PROFILE_UPDATE,
        requestedByModel: requestedByModel,
        actor: updatedBy,
        targetUsers: [targetUser],
        school: user.school,
        changes,
        data: { updateType }
    });
};

// EMAIL CHANGE NOTIFICATION
const sendEmailChangeNotification = async ({ user, oldEmail, newEmail, updatedBy }) => {
    let requestedByModel = 'Staff';
    
    return createNotification({
        type: NOTIFICATION_TYPES.EMAIL_CHANGE,
        requestedByModel: requestedByModel,
        actor: updatedBy,
        targetUsers: [user._id],
        school: user.school,
        data: { oldEmail, newEmail }
    });
};

// BULK EMPLOYEE NOTIFICATIONS
const sendBulkEmployeeNotifications = async ({ users, updatedBy, changes = [], notificationType = NOTIFICATION_TYPES.PROFILE_UPDATE, emailData = null }) => {
    try {
        if (!users || !Array.isArray(users) || users.length === 0) {
            console.error('No users specified for bulk notification');
            return [];
        }

        const notifications = [];
        
        for (const user of users) {
            let notification;
            
            if (notificationType === NOTIFICATION_TYPES.PROFILE_UPDATE) {
                notification = await sendProfileUpdateNotification({
                    user,
                    updatedBy,
                    changes,
                    updateType: user.role
                });
            } else if (notificationType === NOTIFICATION_TYPES.EMAIL_CHANGE && emailData) {
                notification = await sendEmailChangeNotification({
                    user,
                    oldEmail: emailData.oldEmail,
                    newEmail: emailData.newEmail,
                    updatedBy
                });
            }
            
            if (notification) notifications.push(notification);
        }

        console.log(`Bulk notifications sent: ${notifications.length} total`);
        return notifications;
    } catch (error) {
        console.error('Error sending bulk notifications:', error);
        return [];
    }
};

// RESULT NOTIFICATION
const sendResultNotification = async ({ result, actor, action = 'creation' }) => {
    try {
        const student = await Student.findById(result.studentId).select('name classInfo sectionInfo school');
        if (!student) return null;

        return createNotification({
            type: NOTIFICATION_TYPES.RESULT,
            requestedByModel: 'Staff',
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

// DIARY NOTIFICATION
const sendDiaryNotification = async ({ diary, actor, action = 'creation', targetStudentIds = [] }) => {
    try {
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

        return createNotification({
            type: NOTIFICATION_TYPES.DIARY,
            requestedByModel: 'Staff',
            actor,
            targetStudents: finalTargetStudents,
            school: diary.school,
            classId: diary.classId,
            sectionId: diary.sectionId,
            data: {
                diaryType: action,
                diaryTitle: diary.title,
                subjectName: diary.subjectId?.name,
                dueDate: diary.dueDate
            },
            pinned: true
        });
    } catch (error) {
        console.error('Error sending diary notification:', error);
        return null;
    }
};

// DOCUMENT REQUEST NOTIFICATION
const sendDocumentRequestNotification = async ({ documentRequest, actor, targetType = 'student', requestedByModel }) => {
    try {
        const student = await Student.findById(documentRequest.studentId).select('name');
        
        return createNotification({
            type: NOTIFICATION_TYPES.DOCUMENT,
            requestedByModel: requestedByModel || (actor.role === 'teacher' ? 'Staff' : actor.role === 'student' ? 'Student' : 'Staff'),
            actor: actor,
            school: documentRequest.school,
            targetStudents: [documentRequest.studentId],
            target: NOTIFICATION_TARGETS.SELECTED_STUDENTS,
            title: 'New Document Request',
            message: `Document request "${documentRequest.title}" has been created by ${actor.name}.`,
            data: {
                documentType: 'request',
                requestId: documentRequest._id,
                requestType: documentRequest.requestType,
                dueDate: documentRequest.dueDate
            },
            category: NOTIFICATION_CATEGORIES.GENERAL,
            pinned: false
        });
    } catch (error) {
        console.error('Error sending document request notification:', error);
        return null;
    }
};

// DOCUMENT UPLOAD NOTIFICATION
const sendDocumentUploadNotification = async ({ studentDocument, actor }) => {
    try {
        let requester = null;
        let requesterRole = null;
        let schoolId = studentDocument.school;

        if (studentDocument.requestedByModel === 'Staff') {
            requester = await Staff.findById(studentDocument.requestedBy).select('name role school');
            if (requester) requesterRole = requester.role;
        } else if (studentDocument.requestedByModel === 'School') {
            const school = await School.findById(studentDocument.requestedBy).select('name');
            if (school) {
                requester = { _id: school._id, name: school.name, role: 'school' };
                requesterRole = 'school';
            }
        }

        const student = await Student.findById(studentDocument.studentId).select('name');
        const message = `Document "${studentDocument.text || 'Untitled'}" has been uploaded by ${actor.name}.\n\nStudent: ${student?.name || 'Unknown'}\nRequest: ${studentDocument.requestDetails || 'No details provided'}`;

        // Case 1: Student uploaded document
        if (actor.role === 'student') {
            if (requesterRole === 'teacher') {
                return createNotification({
                    type: NOTIFICATION_TYPES.DOCUMENT,
                    requestedByModel: 'Student',
                    actor: actor,
                    school: schoolId,
                    targetTeachers: [requester._id],
                    target: NOTIFICATION_TARGETS.SELECTED_TEACHERS,
                    title: 'Document Uploaded by Student',
                    message: message,
                    data: { documentType: 'upload', uploadedBy: 'student' },
                    category: NOTIFICATION_CATEGORIES.GENERAL,
                    pinned: false
                });
            } else if (requesterRole === 'admin_office' || requesterRole === 'superadmin' || requesterRole === 'school') {
                const adminUsers = await getAdminUsers(schoolId);
                const adminIds = adminUsers.map(u => u._id);
                return createNotification({
                    type: NOTIFICATION_TYPES.DOCUMENT,
                    requestedByModel: 'Student',
                    actor: actor,
                    school: schoolId,
                    targetAdmins: adminIds,
                    target: NOTIFICATION_TARGETS.ADMIN,
                    title: 'Document Uploaded by Student',
                    message: message,
                    data: { documentType: 'upload', uploadedBy: 'student' },
                    category: NOTIFICATION_CATEGORIES.GENERAL,
                    pinned: false
                });
            }
        }
        // Case 2: Teacher uploaded document
        else if (actor.role === 'teacher') {
            if (requesterRole === 'teacher') {
                return createNotification({
                    type: NOTIFICATION_TYPES.DOCUMENT,
                    requestedByModel: 'Staff',
                    actor: actor,
                    school: schoolId,
                    targetTeachers: [requester._id],
                    target: NOTIFICATION_TARGETS.SELECTED_TEACHERS,
                    title: 'Document Uploaded by Teacher',
                    message: message,
                    data: { documentType: 'upload', uploadedBy: 'teacher' },
                    category: NOTIFICATION_CATEGORIES.GENERAL,
                    pinned: false
                });
            } else if (requesterRole === 'admin_office' || requesterRole === 'superadmin' || requesterRole === 'school') {
                const adminUsers = await getAdminUsers(schoolId);
                const adminIds = adminUsers.map(u => u._id);
                return createNotification({
                    type: NOTIFICATION_TYPES.DOCUMENT,
                    requestedByModel: 'Staff',
                    actor: actor,
                    school: schoolId,
                    targetAdmins: adminIds,
                    target: NOTIFICATION_TARGETS.ADMIN,
                    title: 'Document Uploaded by Teacher',
                    message: message,
                    data: { documentType: 'upload', uploadedBy: 'teacher' },
                    category: NOTIFICATION_CATEGORIES.GENERAL,
                    pinned: false
                });
            }
        }
        
        return null;
    } catch (error) {
        console.error('Error sending document upload notification:', error);
        return null;
    }
};

// STUDENT LEAVE NOTIFICATION
const sendStudentLeaveNotification = async ({ leave, actor, action = 'create', requestedByModel = 'Student' }) => {
    try {
        const adminUsers = await getAdminUsers(leave.school);
        const adminIds = adminUsers.map(u => u._id);

        if (action === 'create' || action === 'update' || action === 'cancel') {
            return createNotification({
                type: NOTIFICATION_TYPES.LEAVE,
                requestedByModel: requestedByModel,
                actor: actor,
                school: leave.school,
                targetAdmins: adminIds,
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
                requestedByModel: requestedByModel,
                actor: actor,
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

// TEACHER LEAVE NOTIFICATION
const sendTeacherLeaveNotification = async ({ leave, actor, action = 'create', requestedByModel = 'Staff' }) => {
    try {
        const adminUsers = await getAdminUsers(leave.school);
        const adminIds = adminUsers.map(u => u._id);

        if (action === 'create' || action === 'update' || action === 'cancel') {
            return createNotification({
                type: NOTIFICATION_TYPES.LEAVE,
                requestedByModel: requestedByModel,
                actor: actor,
                school: leave.school,
                targetAdmins: adminIds,
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
                requestedByModel: requestedByModel,
                actor: actor,
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

// FEE NOTIFICATIONS
const sendFeeNotificationToStudent = async (fee, actor, action = 'created') => {
    try {
        const student = await Student.findById(fee.studentId).select('name email school');
        if (!student) return null;

        let title, message;
        if (action === 'created') {
            title = 'New Fee Generated';
            message = `A new fee of ₹${fee.amount} for ${fee.month} has been generated by ${actor.name}. Title: ${fee.title}`;
        } else if (action === 'updated') {
            title = 'Fee Updated';
            message = `Your fee for ${fee.month} has been updated by ${actor.name}. New amount: ₹${fee.amount}`;
        } else if (action === 'submitted') {
            title = 'Payment Proof Submitted';
            message = `Payment proof for fee of ₹${fee.amount} (${fee.month}) has been submitted. Awaiting admin approval.`;
        }

        return createNotification({
            type: NOTIFICATION_TYPES.FEE,
            requestedByModel: actor.role === 'student' ? 'Student' : 'Staff',
            actor,
            targetStudents: [fee.studentId],
            school: fee.school,
            title,
            message,
            data: {
                feeId: fee._id,
                amount: fee.amount,
                month: fee.month,
                title: fee.title,
                status: fee.status,
                action
            },
            category: NOTIFICATION_CATEGORIES.GENERAL,
            pinned: false
        });
    } catch (error) {
        console.error('Error sending fee notification to student:', error);
        return null;
    }
};

const sendFeeNotificationToAdmins = async (fee, actor) => {
    try {
        const adminUsers = await getAdminUsers(fee.school);
        const adminIds = adminUsers.map(u => u._id);
        
        const student = await Student.findById(fee.studentId).select('name');

        const title = 'Payment Proof Submitted';
        const message = `Student ${student?.name || 'Unknown'} has submitted payment proof for fee of ₹${fee.amount} (${fee.month}). Please review.`;

        return createNotification({
            type: NOTIFICATION_TYPES.FEE,
            requestedByModel: actor.role === 'student' ? 'Student' : 'Staff',
            actor,
            targetAdmins: adminIds,
            target: NOTIFICATION_TARGETS.ADMIN,
            school: fee.school,
            title,
            message,
            data: {
                feeId: fee._id,
                studentId: fee.studentId,
                studentName: student?.name,
                amount: fee.amount,
                month: fee.month,
                title: fee.title,
                status: fee.status
            },
            category: NOTIFICATION_CATEGORIES.GENERAL,
            pinned: false
        });
    } catch (error) {
        console.error('Error sending fee notification to admins:', error);
        return null;
    }
};

const sendPaymentStatusNotification = async (fee, actor, status) => {
    try {
        const student = await Student.findById(fee.studentId).select('name email school');
        if (!student) return null;

        const title = `Payment ${status === 'approved' ? 'Approved' : 'Rejected'}`;
        const message = `Your payment of ₹${fee.amount} for ${fee.month} has been ${status} by ${actor.name}.`;

        return createNotification({
            type: NOTIFICATION_TYPES.FEE,
            requestedByModel: 'Staff',
            actor,
            targetStudents: [fee.studentId],
            school: fee.school,
            title,
            message,
            data: {
                feeId: fee._id,
                amount: fee.amount,
                month: fee.month,
                title: fee.title,
                status: status
            },
            category: NOTIFICATION_CATEGORIES.GENERAL,
            pinned: false
        });
    } catch (error) {
        console.error('Error sending payment status notification:', error);
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
    switch (action) {
        case 'create':
            return `Leave application submitted by ${leave.studentName} for ${leave.dates?.length} day(s). Subject: ${leave.subject}`;
        case 'update':
            return `Leave application updated by ${leave.studentName}. Subject: ${leave.subject}`;
        case 'cancel':
            return `Leave cancelled by ${leave.studentName}.`;
        case 'approve':
            return `Your leave application for ${leave.dates?.length} day(s) has been approved by ${actor.name}.`;
        case 'reject':
            return `Your leave application for ${leave.dates?.length} day(s) has been rejected by ${actor.name}.${leave.remark ? ` Reason: ${leave.remark}` : ''}`;
        default:
            return `Leave application ${action} by ${leave.studentName}.`;
    }
};

const getTeacherLeaveMessage = (leave, actor, action) => {
    switch (action) {
        case 'create':
            return `Leave application submitted by teacher ${leave.teacherName} for ${leave.dates?.length} day(s). Subject: ${leave.subject}`;
        case 'update':
            return `Leave application updated by teacher ${leave.teacherName}. Subject: ${leave.subject}`;
        case 'cancel':
            return `Leave cancelled by teacher ${leave.teacherName}.`;
        case 'approve':
            return `Your leave application for ${leave.dates?.length} day(s) has been approved by ${actor.name}.`;
        case 'reject':
            return `Your leave application for ${leave.dates?.length} day(s) has been rejected by ${actor.name}.${leave.remark ? ` Reason: ${leave.remark}` : ''}`;
        default:
            return `Leave application ${action} by teacher ${leave.teacherName}.`;
    }
};

module.exports = {
    NOTIFICATION_TYPES,
    NOTIFICATION_CATEGORIES,
    NOTIFICATION_TARGETS,
    createNotification,
    getUsersFromClassSection,
    sendProfileUpdateNotification,
    sendEmailChangeNotification,
    sendBulkEmployeeNotifications,
    sendResultNotification,
    sendDiaryNotification,
    sendDocumentRequestNotification,
    sendDocumentUploadNotification,
    sendStudentLeaveNotification,
    sendTeacherLeaveNotification,
    sendFeeNotificationToStudent,
    sendFeeNotificationToAdmins,
    sendPaymentStatusNotification
};