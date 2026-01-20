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


router.post('/',
  protect,
  isAdminOffice,
  upload.single('video'),
  validateCreateMedia,
  createMedia
);

router.put('/:id',
  protect,
  isAdminOffice,
  upload.single('video'),
  validateUpdateMedia,
  updateMedia
);

router.delete('/:id',
  protect,
  isAdminOffice,
  deleteMedia
);

router.get('/school',
  protect,
  isAdminOffice,
  validateFilter,
  getOwnUploads
);

router.get('/feed',
  protect,
  isTeacherOrStudent,
  validateFilter,
  getFeed
);

router.get('/:id',
  protect,
  allowedRoles,
  getById
);

module.exports = router;