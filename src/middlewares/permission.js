const checkPermission = (permission) => {
  return (req, res, next) => {
    try {
      if (req.user && req.user.role === 'superadmin') {
        return next();
      }
      
      const userPermissions = req.user?.permissions || [];
      
      if (!userPermissions.includes(permission)) {
        return res.status(403).json({
          success: false,
          message: `Access denied. Required permission: ${permission}`,
          missingPermission: permission
        });
      }
      
      next();
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: "Permission check failed",
        error: error.message
      });
    }
  };
};


const checkAnyPermission = (...permissions) => {
  return (req, res, next) => {
    try {
      if (req.user && req.user.role === 'superadmin') {
        return next();
      }
      
      const userPermissions = req.user?.permissions || [];
      const hasPermission = permissions.some(p => userPermissions.includes(p));
      
      if (!hasPermission) {
        return res.status(403).json({
          success: false,
          message: `Access denied. Need one of: ${permissions.join(', ')}`,
          requiredPermissions: permissions
        });
      }
      
      next();
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: "Permission check failed",
        error: error.message
      });
    }
  };
};

const checkAllPermissions = (...permissions) => {
  return (req, res, next) => {
    try {
      if (req.user && req.user.role === 'superadmin') {
        return next();
      }
      
      const userPermissions = req.user?.permissions || [];
      const missingPermissions = permissions.filter(p => !userPermissions.includes(p));
      
      if (missingPermissions.length > 0) {
        return res.status(403).json({
          success: false,
          message: `Access denied. Missing permissions: ${missingPermissions.join(', ')}`,
          missingPermissions
        });
      }
      
      next();
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: "Permission check failed",
        error: error.message
      });
    }
  };
};

module.exports = {
  checkPermission,
  checkAnyPermission,
  checkAllPermissions
};