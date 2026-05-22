const express = require('express');
const router = express.Router();
const { 
  protect, 
  isAdminOffice, 
  isTeacherOrStudent,
  allowedRoles,
} = require('../middlewares/auth');
const { 
  createMedia, 
  updateMedia, 
  deleteMedia, 
  getOwnUploads,
  getFeed, 
  getById 
} = require('../controllers/schoolMedia.controller');
const { 
  validateCreateMedia, 
  validateUpdateMedia, 
  validateFilter 
} = require('../validators/schoolMedia.validator');
const { upload } = require('../utils/multer');
const { checkPermission } = require('../middlewares/permission');


router.post('/',
  protect,
  isAdminOffice,
  checkPermission("socialmedia"),
  upload.single('video'),
  validateCreateMedia,
  createMedia
);

router.put('/:id',
  protect,
  isAdminOffice,
  checkPermission("socialmedia"),
  upload.single('video'),
  validateUpdateMedia,
  updateMedia
);

router.delete('/:id',
  protect,
  isAdminOffice,
  checkPermission("socialmedia"),
  deleteMedia
);

router.get('/school',
  protect,
  isAdminOffice,
  checkPermission("socialmedia"),
  validateFilter,
  getOwnUploads
);

router.get('/feed',
  protect,
  isTeacherOrStudent,
  checkPermission("socialmedia"),
  validateFilter,
  getFeed
);

router.get('/:id',
  protect,
  allowedRoles,
  checkPermission("socialmedia"),
  getById
);

module.exports = router;