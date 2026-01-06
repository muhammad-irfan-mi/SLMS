const express = require('express');
const router = express.Router();
const { 
  protect, 
  isAdminOffice, 
  isTeacherOrStudent,
  isSchool 
} = require('../middlewares/auth');
const { 
  createMedia, 
  createAdminMedia,
  updateMedia, 
  deleteMedia, 
  getBySchool, 
  getFeed, 
  getById 
} = require('../controllers/schoolMedia.controller');
const { 
  validateCreateMedia, 
  validateUpdateMedia, 
  validateFilter, 
  validateFile 
} = require('../validators/schoolMedia.validator');
const { upload } = require('../utils/multer');

// Middleware to detect and attach role
const attachUserRole = (req, res, next) => {
  // Detect school role
  if (!req.user.role) {
    if (req.user.schoolId) {
      req.user.role = 'school';
    } else if (req.user.verified !== undefined && req.user.email) {
      req.user.role = 'school';
    }
  }
  next();
};

// School uploads media
router.post('/school', 
  protect, 
  upload.single('video'),
  validateFile,
  validateCreateMedia,
  isAdminOffice,
  createMedia
);

// Admin office uploads media
router.post('/admin', 
  protect, 
  isAdminOffice,
  upload.single('video'),
  validateFile,
  validateCreateMedia,
  createAdminMedia
);

// Update media (school or admin office)
router.patch('/:id',
  protect,
  attachUserRole,
  upload.single('video'),
  validateFile,
  validateUpdateMedia,
  updateMedia
);

// Delete media (school or admin office)
router.delete('/:id',
  protect,
  attachUserRole,
  deleteMedia
);

// Get media by school (for school and admin office)
router.get('/school/:schoolId?',
  protect,
  attachUserRole,
  validateFilter,
  getBySchool
);

// Feed for teachers and students
router.get('/feed',
  protect,
  isTeacherOrStudent,
  validateFilter,
  getFeed
);

// Get single media by ID
router.get('/:id',
  protect,
  attachUserRole,
  getById
);

module.exports = router;