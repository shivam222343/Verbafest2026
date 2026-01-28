const multer = require('multer');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const { cloudinary } = require('../config/cloudinary');

// Cloudinary storage for payment proofs
const paymentProofStorage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
        folder: 'event-orchestration/payment-proofs',
        allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
        transformation: [{ width: 1000, height: 1000, crop: 'limit' }]
    }
});

// File filter
const fileFilter = (req, file, cb) => {
    // Accept images only
    if (file.mimetype.startsWith('image/')) {
        cb(null, true);
    } else {
        cb(new Error('Only image files are allowed'), false);
    }
};

// Cloudinary storage for system settings (QR codes etc)
const systemSettingsStorage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
        folder: 'event-orchestration/system-settings',
        allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
        transformation: [{ width: 800, height: 800, crop: 'limit' }]
    }
});

// Cloudinary storage for banner (wider)
const bannerStorage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
        folder: 'event-orchestration/banners',
        allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
        transformation: [{ width: 1500, height: 500, crop: 'limit' }]
    }
});

// Upload middleware for payment proofs
exports.uploadPaymentProof = multer({
    storage: paymentProofStorage,
    fileFilter: fileFilter,
    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB max file size
    }
});

// Upload middleware for system images (QR code)
exports.uploadSystemImage = multer({
    storage: systemSettingsStorage,
    fileFilter: fileFilter,
    limits: {
        fileSize: 2 * 1024 * 1024 // 2MB max file size
    }
});

// Upload middleware for banners
exports.uploadBanner = multer({
    storage: bannerStorage,
    fileFilter: fileFilter,
    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB max file size
    }
});
