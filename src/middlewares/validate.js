module.exports = (schema, property = "body") => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req[property], {
      abortEarly: false,
      stripUnknown: true,
      convert: true,
    });

    if (error) {
      return res.status(400).json({
        message: "Validation error",
        errors: error.details.map(d => ({
          field: d.path.join('.'),
          message: d.message
        })),
      });
    }

    req[property] = value;
    next();
  };
};