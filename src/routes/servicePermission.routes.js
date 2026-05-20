const express = require('express');
const router = express.Router();
const { protect, isSuperAdmin } = require('../middlewares/auth');
const { getServiceById, getAllServices } = require('../controllers/servicePermission.controller');



router.get('/:id', protect, isSuperAdmin, getServiceById);
router.get('/', protect, isSuperAdmin, getAllServices);

module.exports = router;