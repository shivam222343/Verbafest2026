const express = require('express');
const router = express.Router();
const SystemSettings = require('../../models/SystemSettings');
const { protect, authorize } = require('../../middleware/auth');
const { uploadSystemImage } = require('../../middleware/upload');

router.use(protect);
router.use(authorize('admin'));

// @desc    Upload QR Code
// @route   POST /api/admin/settings/upload-qr
router.post('/upload-qr', uploadSystemImage.single('qrCode'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, message: 'Please upload a file' });
        }
        res.json({ success: true, url: req.file.path });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// @desc    Get system settings
// @route   GET /api/admin/settings
router.get('/', async (req, res) => {
    try {
        let settings = await SystemSettings.findOne({ key: 'core_settings' });
        if (!settings) {
            settings = await SystemSettings.create({ key: 'core_settings' });
        }
        res.json({ success: true, data: settings });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// @desc    Update system settings
// @route   PUT /api/admin/settings
router.put('/', async (req, res) => {
    try {
        const settings = await SystemSettings.findOneAndUpdate(
            { key: 'core_settings' },
            req.body,
            { new: true, upsert: true }
        );
        res.json({ success: true, data: settings });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

module.exports = router;
