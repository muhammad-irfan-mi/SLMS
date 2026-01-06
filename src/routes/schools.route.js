const express = require('express');
const router = express.Router();
const { validationSchemas } = require('../validators/school.validator');
const validate = require('../middlewares/validate');
const multer = require('multer');
const { verifySchoolOTP, resendSchoolOTP, setSchoolPassword, addSchoolBySuperAdmin, editSchoolBySuperAdmin, deleteSchoolBySuperAdmin, getAllSchools, getPendingRegistrations, getSchoolById } = require('../controllers/schoolController');
const { upload } = require("../utils/multer");

// OTP Verification Routes
router.post(
    '/verify-otp',
    validate(validationSchemas.verifyOTP),
    verifySchoolOTP
);

router.post(
    '/resend-otp',
    validate(validationSchemas.resendOTP),
    resendSchoolOTP
);

router.post(
    '/set-password',
    validate(validationSchemas.setPassword),
    setSchoolPassword
);

// Existing routes with validation
router.post(
    '/add-school',
    upload.fields([
        { name: 'cnicFront', maxCount: 1 },
        { name: 'cnicBack', maxCount: 1 },
        { name: 'nocDoc', maxCount: 1 }
    ]),
    validate(validationSchemas.addSchool),
    addSchoolBySuperAdmin
);

router.put(
    '/edit/:id',
    upload.fields([
        { name: 'cnicFront', maxCount: 1 },
        { name: 'cnicBack', maxCount: 1 },
        { name: 'nocDoc', maxCount: 1 }
    ]),
    validate(validationSchemas.idParam, 'params'),
    validate(validationSchemas.updateSchool),
    editSchoolBySuperAdmin
);

router.delete(
    '/delete/:id',
    validate(validationSchemas.idParam, 'params'),
    deleteSchoolBySuperAdmin
);

router.get(
    '/',
    validate(validationSchemas.paginationQuery, 'query'),
    getAllSchools
);

router.get(
    '/pending',
    getPendingRegistrations
);

router.get(
    '/:id',
    validate(validationSchemas.idParam, 'params'),
    getSchoolById
);

module.exports = router;