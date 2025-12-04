const router = require("express").Router();
const { createAiVideo, updateAiVideo, deleteAiVideo, getVideosForSuperadmin, getVideosBySchool, getVideoById } = require("../controllers/aiYusahVideo.controller");
const { protect, isSuperAdmin, allowedRoles } = require("../middlewares/auth");


router.post("/", protect, isSuperAdmin, createAiVideo);
router.put("/:id", protect, isSuperAdmin, updateAiVideo);
router.delete("/:id", protect, isSuperAdmin, deleteAiVideo);
router.get("/", protect, isSuperAdmin, getVideosForSuperadmin);

router.get("/school/:id", protect, allowedRoles, getVideoById);
router.get("/school", protect, allowedRoles, getVideosBySchool);

router.get("/:id", protect, isSuperAdmin, getVideoById);

module.exports = router;
