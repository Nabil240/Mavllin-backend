const path = require('path');
const fs = require('fs');
const multer = require('multer');

// Ensure destination directories exist
const productsDir = path.join(__dirname, '../../uploads/products');
const avatarsDir = path.join(__dirname, '../../uploads/avatars');

[productsDir, avatarsDir].forEach((dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

const storageFactory = (uploadDir) =>
  multer.diskStorage({
    destination: (_req, _file, cb) => {
      cb(null, uploadDir);
    },
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      const baseName = path
        .basename(file.originalname, ext)
        .replace(/[^a-zA-Z0-9_-]/g, '')
        .slice(0, 30);
      const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
      cb(null, `${baseName}-${uniqueSuffix}${ext}`);
    },
  });

const imageFileFilter = (_req, file, cb) => {
  const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    const error = new Error('Only image files (JPEG, PNG, WEBP, GIF) are allowed');
    error.statusCode = 400;
    cb(error, false);
  }
};

const uploadProductImage = multer({
  storage: storageFactory(productsDir),
  fileFilter: imageFileFilter,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
});

const uploadAvatarImage = multer({
  storage: storageFactory(avatarsDir),
  fileFilter: imageFileFilter,
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB
});

module.exports = {
  uploadProductImage,
  uploadAvatarImage,
};
