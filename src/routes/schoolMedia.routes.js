const express = require('express');
const router = express.Router();
const { protect, isAdminOffice, isTeacherOrStudent } = require('../middlewares/auth');

const { createMedia, updateMedia, deleteMedia, getBySchool, getFeed, getById, } = require('../controllers/schoolMedia.controller');
const { upload } = require('../utils/multer');

router.post('/', protect, isAdminOffice, upload.single('video'), createMedia);
router.patch('/:id', protect, isAdminOffice, upload.single('video'), updateMedia);
router.delete('/:id', protect, isAdminOffice, deleteMedia);
router.get('/school/:schoolId', protect, isAdminOffice, getBySchool);
router.get('/feed', protect, isTeacherOrStudent, getFeed);
router.get('/:id', getById);

module.exports = router;
