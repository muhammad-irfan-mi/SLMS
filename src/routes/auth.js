const express = require("express");
const router = express.Router();
const { 
  superAdminLogin, 
  setPassword, 
  schoolLogin, 
  // setPasswordForUser, 
  // userLogin, 
  setPasswordForStudent,
  setPasswordForStaff,
  staffLogin,
  studentLogin
} = require("../controllers/authController");
const validate = require("../middlewares/validate");
const { validationSchemas } = require("../validators/user.validation");

router.post("/superadmin-login", superAdminLogin);

router.post("/school/set-password", 
  validate(validationSchemas.setPassword), 
  setPassword
);

router.post("/school/login", 
  validate(validationSchemas.login), 
  schoolLogin
);

// router.post("/user/set-password", 
//   validate(validationSchemas.setPassword), 
//   setPasswordForUser
// );
router.post("/user/set-password-student", 
  validate(validationSchemas.setPassword), 
  setPasswordForStudent
);
router.post("/user/set-password-staff", 
  validate(validationSchemas.setPassword), 
  setPasswordForStaff
);

// router.post("/user/login", 
//   validate(validationSchemas.login), 
//   userLogin
// );
router.post("/user-login/staff", 
  validate(validationSchemas.loginStaff), 
  staffLogin
);
router.post("/user-login/student", 
  validate(validationSchemas.loginStudent), 
  studentLogin
);

module.exports = router;