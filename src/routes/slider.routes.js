const express = require("express");
const router = express.Router();

const {
    createSuperadminSlider,
    createSchoolSlider,
    getVisibleSliders,
    getSuperadminSliders,
    getSchoolAdminSliders,
    getSliderById,
    updateSlider,
    deleteSlider
} = require("../controllers/slider.controller");

const {
    isSuperAdmin,
    isAdminOffice,
    isSchool,
    allowedRoles,
    protect
} = require("../middlewares/auth");

const {
    createSuperadminSliderSchema,
    createSchoolSliderSchema,
    updateSliderSchema,
    getSlidersQuerySchema,
    idParamSchema,
    validateBody,
    validateQuery,
    validateParams
} = require("../validators/slider.validation");

const { upload } = require("../utils/multer");

const validateFile = (req, res, next) => {
    if (req.route.path === '/' || req.route.path === '/school') {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: 'Image file is required'
            });
        }
        
        const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
        if (!allowedTypes.includes(req.file.mimetype)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid file type. Only JPEG, PNG, GIF, and WebP are allowed'
            });
        }
        
        const maxSize = 5 * 1024 * 1024; 
        if (req.file.size > maxSize) {
            return res.status(400).json({
                success: false,
                message: 'File too large. Maximum size is 5MB'
            });
        }
    }
    next();
};

router.post("/",
    protect,
    isSuperAdmin,
    upload.single("image"),
    validateFile,
    validateBody(createSuperadminSliderSchema),
    createSuperadminSlider
);

router.get("/superadmin",
    protect,
    isSuperAdmin,
    validateQuery(getSlidersQuerySchema),
    getSuperadminSliders
);

router.post("/school",
    protect,
    isAdminOffice,
    upload.single("image"),
    validateFile,
    validateBody(createSchoolSliderSchema),
    createSchoolSlider
);

router.get("/school",
    protect,
    isAdminOffice,
    validateQuery(getSlidersQuerySchema),
    getSchoolAdminSliders
);

router.get("/visible",
    protect,
    allowedRoles,
    validateQuery(getSlidersQuerySchema),
    getVisibleSliders
);

// router.get("/:id",
//     protect,
//     allowedRoles,
//     validateParams(idParamSchema),
//     getSliderById
// );


router.put("/:id",
    protect,
    allowedRoles,
    upload.single("image"),
    validateFile,
    validateParams(idParamSchema),
    validateBody(updateSliderSchema),
    updateSlider
);


router.delete("/:id",
    protect,
    allowedRoles,
    validateParams(idParamSchema),
    deleteSlider
);

module.exports = router;