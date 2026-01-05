const router = require("express").Router();
const { 
  createAiVideo, 
  updateAiVideo, 
  deleteAiVideo, 
  getVideosForSuperadmin, 
  getVideosForAll, 
  getVideoById,
  toggleVideoStatus
} = require("../controllers/aiYusahVideo.controller");
const { validateVideo, validateFilter } = require("../validators/aiYusahVideo.validation");
const { protect, isSuperAdmin } = require("../middlewares/auth");

const attachUserRole = (req, res, next) => {
  if (!req.user.role && req.user.schoolId) {
    req.user.role = 'school';
  }
  else if (!req.user.role && req.user.verified !== undefined && req.user.email) {
    req.user.role = 'school';
  }
  next();
};

router.post("/",
  protect,
  isSuperAdmin,
  validateVideo,
  createAiVideo
);

router.put("/:id",
  protect,
  isSuperAdmin,
  validateVideo,
  updateAiVideo
);

router.delete("/:id",
  protect,
  isSuperAdmin,
  deleteAiVideo
);

router.patch("/:id/status",
  protect,
  isSuperAdmin,
  toggleVideoStatus
);

router.get("/admin",
  protect,
  isSuperAdmin,
  validateFilter,
  getVideosForSuperadmin
);

router.get("/",
  protect,
  attachUserRole,
  validateFilter,
  getVideosForAll
);

router.get("/:id",
  protect,
  attachUserRole,
  getVideoById
);

module.exports = router;