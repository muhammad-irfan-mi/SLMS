const permit = (...allowed) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: "No user" });
    }

    if (req.user.type === "school") {
      return next();
    }

    if (req.user.type === "employee" && req.user.employee && allowed.includes(req.user.employee.role)) {
      return next();
    }

    return res.status(403).json({ message: "Forbidden" });
  };
};

module.exports = { permit };
