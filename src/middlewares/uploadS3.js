const multer = require('multer');
const multerS3 = require('multer-s3');
const { s3 } = require('../services/s3');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const upload = multer({
  storage: multerS3({
    s3,
    bucket: process.env.AWS_BUCKET_NAME,
    acl: 'public-read',
    metadata: function (req, file, cb) {
      cb(null, { fieldName: file.fieldname });
    },
    key: function (req, file, cb) {
      const ext = path.extname(file.originalname);
      const filename = `${file.fieldname}/${Date.now()}-${uuidv4()}${ext}`;
      cb(null, filename);
    }
  }),
  limits: { fileSize: 5 * 1024 * 1024 }
});

module.exports = upload;