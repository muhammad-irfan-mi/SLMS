const School = require("../models/School");
const { validateSchoolName } = require("./common.validation");

const validateSchoolNameUniqueness = async (name, excludeId = null) => {
  const error = validateSchoolName(name);
  if (error) return error;

  const query = {
    name: { $regex: `^${name}$`, $options: "i" },
  };

  if (excludeId) query._id = { $ne: excludeId };

  const exists = await School.findOne(query);
  if (exists) return "School name already exists";

  return null;
};

module.exports = { validateSchoolNameUniqueness };
