const multer = require('multer');

const storage = multer.memoryStorage();

// const fileFilter = (req, file, cb) => {
//   const allowedTypes = ['text/csv', 'application/json', 'text/plain'];

//   if (allowedTypes.includes(file.mimetype) ||
//     file.originalname.endsWith('.csv') ||
//     file.originalname.endsWith('.json')) {
//     cb(null, true);
//   } else {
//     cb(new Error('Invalid file type. Only CSV and JSON files are allowed.'), false);
//   }
// };

const fileFilter = (req, file, cb) => {
  cb(null, true);
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 20 * 1024 * 1024 },
});

module.exports = {
  upload
};
