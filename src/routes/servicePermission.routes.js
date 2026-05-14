const express = require('express');
const router = express.Router();
const { protect, isSuperAdmin } = require('../middlewares/auth');
const {
  createService,
  getAllServices,
  updateService,
  deleteService,
  getServiceById
} = require('../controllers/servicePermission.controller');


router.post('/',protect, isSuperAdmin, createService);
router.put('/:id', protect, isSuperAdmin, updateService);
router.get('/:id', protect, isSuperAdmin, getServiceById);
router.delete('/:id', protect, isSuperAdmin, deleteService);
router.get('/', getAllServices);

module.exports = router;