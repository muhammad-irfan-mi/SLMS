const express = require('express');
const router = express.Router();
const { protect, isSuperAdmin } = require('../middlewares/auth');
const {
  createAiVideo,
  updateAiVideo,
  getVideosForSuperadmin,
  getVideosForAll,
  getVideoById,
  deleteAiVideo,
  toggleVideoStatus
} = require('../controllers/aiYusahVideo.controller');
const { validateVideo, validateFilter, validateMediaUrl } = require('../validators/aiYusahVideo.validation');

router.get('/admin', protect, isSuperAdmin, validateFilter, getVideosForSuperadmin);
router.post('/', protect, isSuperAdmin, validateVideo, validateMediaUrl, createAiVideo);

router.get('/', protect, validateFilter, getVideosForAll);

router.get('/:id', protect, getVideoById);
router.put('/:id', protect, isSuperAdmin, validateVideo, validateMediaUrl, updateAiVideo);
router.delete('/:id', protect, isSuperAdmin, deleteAiVideo);
router.patch('/:id/toggle-status', protect, isSuperAdmin, toggleVideoStatus);

module.exports = router;