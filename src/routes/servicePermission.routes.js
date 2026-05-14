const express = require('express');
const router = express.Router();
const { protect, isSuperAdmin } = require('../middlewares/auth');
const { createService, updateService, getServiceById, deleteService, getAllServices } = require('../controllers/servicePermission.controller');



router.post('/',protect, isSuperAdmin, createService);
router.put('/:id', protect, isSuperAdmin, updateService);
router.get('/:id', protect, isSuperAdmin, getServiceById);
router.delete('/:id', protect, isSuperAdmin, deleteService);
router.get('/', protect, isSuperAdmin, getAllServices);

module.exports = router;