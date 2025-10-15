const express = require("express");
const router = express.Router();
const { superAdminLogin } = require("../controllers/authController");

router.post("/superadmin-login", superAdminLogin);

module.exports = router;