const express = require('express');
const router = express.Router();
const { validationSchemas } = require('../validators/school.validator');
const validate = require('../middlewares/validate');
const multer = require('multer');
const { verifySchoolOTP, resendSchoolOTP, setSchoolPassword, addSchoolBySuperAdmin, editSchoolBySuperAdmin, deleteSchoolBySuperAdmin, getAllSchools, getPendingRegistrations, getSchoolById, updateSchoolLogo, removeSchoolLogo } = require('../controllers/school.controller');
const { upload } = require("../utils/multer");
const { isSuperAdmin, isAdminOffice, protect } = require('../middlewares/auth');

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

router.post(
    '/add-school',
    upload.fields([
        { name: 'cnicFront', maxCount: 1 },
        { name: 'cnicBack', maxCount: 1 },
        { name: 'nocDoc', maxCount: 1 },
        { name: 'logo', maxCount: 1 }
    ]),
    protect,
    isSuperAdmin,
    validate(validationSchemas.addSchool),
    addSchoolBySuperAdmin
);

router.put(
    '/edit/:id',
    upload.fields([
        { name: 'cnicFront', maxCount: 1 },
        { name: 'cnicBack', maxCount: 1 },
        { name: 'nocDoc', maxCount: 1 },
        { name: 'logo', maxCount: 1 }
    ]),
    protect,
    isSuperAdmin,
    validate(validationSchemas.idParam, 'params'),
    validate(validationSchemas.updateSchool),
    editSchoolBySuperAdmin
);

router.delete(
    '/delete/:id',
    protect,
    isSuperAdmin,
    validate(validationSchemas.idParam, 'params'),
    deleteSchoolBySuperAdmin
);

router.get(
    '/',
    protect,
    isSuperAdmin,
    validate(validationSchemas.paginationQuery, 'query'),
    getAllSchools
);

router.get(
    '/pending',
    protect,
    isSuperAdmin,
    getPendingRegistrations
);

router.get(
    '/:id',
    validate(validationSchemas.idParam, 'params'),
    getSchoolById
);

router.put(
    '/:id/logo',
    protect,
    isAdminOffice,
    upload.fields([
        { name: 'logo', maxCount: 1 }
    ]),
    validate(validationSchemas.idParam, 'params'),
    updateSchoolLogo
);


module.exports = router;