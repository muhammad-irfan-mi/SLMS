const express = require("express");
const router = express.Router();
const { upload } = require("../utils/multer");
const { addSchoolBySuperAdmin, deleteSchoolBySuperAdmin, editSchoolBySuperAdmin } = require('../controllers/schoolController')
const { setPassword, schoolLogin } = require("../controllers/authController");
const { protect, isSuperAdmin } = require("../middlewares/auth");

router.post(
    "/add-school",
    protect,
    isSuperAdmin,
    upload.fields([
        { name: "cnicFront", maxCount: 1 },
        { name: "cnicBack", maxCount: 1 },
        { name: "nocDoc", maxCount: 1 },
    ]),
    addSchoolBySuperAdmin
);
router.put(
    "/edit-school/:id",
    protect,
    isSuperAdmin,
    upload.fields([
        { name: "cnicFront", maxCount: 1 },
        { name: "cnicBack", maxCount: 1 },
        { name: "nocDoc", maxCount: 1 },
    ]),
    editSchoolBySuperAdmin
);

router.delete("/delete-school/:id", protect, isSuperAdmin, deleteSchoolBySuperAdmin);
router.post("/set-school-password", setPassword);
router.post("/school-login", schoolLogin);

module.exports = router;
