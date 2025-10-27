const express = require('express')
const { isTeacher, protect } = require('../middlewares/auth')
const { markAttendance, getAttendanceBySection, getAttendanceBySubject, getStudentAttendance, editSingleStudentAttendance, editMultipleStudentsAttendance, removeStudentFromAttendance, deleteAttendanceRecord } = require('../controllers/attendance.controller')
const router = express.Router()


router.post('/', protect, isTeacher, markAttendance)
router.get('/section/:sectionId', protect, isTeacher, getAttendanceBySection);
router.get('/subject/:subjectId', protect, isTeacher, getAttendanceBySubject);
router.get('/:studentId', protect, isTeacher, getStudentAttendance);
router.get('/student/:studentId', protect, isTeacher, getStudentAttendance);
router.patch('/:attendanceId/student/:studentId', protect, isTeacher, editSingleStudentAttendance);
router.patch('/:attendanceId/students', protect, isTeacher, editMultipleStudentsAttendance);
router.delete('/:attendanceId/student/:studentId', protect, isTeacher, removeStudentFromAttendance);
router.delete('/:attendanceId', protect, isTeacher, deleteAttendanceRecord);

module.exports = router