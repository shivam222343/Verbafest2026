const express = require('express');
const router = express.Router();
const PaymentSettings = require('../../models/PaymentSettings');
const { protect, authorize } = require('../../middleware/auth');

// All routes are protected and require admin role
router.use(protect);
router.use(authorize('admin'));

// @route   GET /api/admin/payment-settings
// @desc    Get active payment settings
// @access  Private (Admin)
router.get('/', async (req, res, next) => {
    try {
        const settings = await PaymentSettings.getActiveSettings();

        res.status(200).json({
            success: true,
            data: settings
        });
    } catch (error) {
        next(error);
    }
});

// @route   PUT /api/admin/payment-settings
// @desc    Update payment settings
// @access  Private (Admin)
router.put('/', async (req, res, next) => {
    try {
        const {
            upiId,
            accountName,
            bulkRegistrationDiscount,
            qrCodeEnabled,
            paymentInstructions
        } = req.body;

        let settings = await PaymentSettings.getActiveSettings();

        // Update fields
        if (upiId !== undefined) settings.upiId = upiId;
        if (accountName !== undefined) settings.accountName = accountName;
        if (bulkRegistrationDiscount !== undefined) {
            settings.bulkRegistrationDiscount = {
                ...settings.bulkRegistrationDiscount,
                ...bulkRegistrationDiscount
            };
        }
        if (qrCodeEnabled !== undefined) settings.qrCodeEnabled = qrCodeEnabled;
        if (paymentInstructions !== undefined) settings.paymentInstructions = paymentInstructions;

        settings.updatedBy = req.user._id;
        await settings.save();

        // Emit socket event to all admins
        const io = req.app.get('io');
        if (io) {
            io.to('admin').emit('payment-settings:updated', {
                upiId: settings.upiId,
                accountName: settings.accountName,
                discountEnabled: settings.bulkRegistrationDiscount.enabled
            });
        }

        res.status(200).json({
            success: true,
            message: 'Payment settings updated successfully',
            data: settings
        });
    } catch (error) {
        next(error);
    }
});

// @route   POST /api/admin/payment-settings/calculate-discount
// @desc    Calculate discount for given amount and event count
// @access  Private (Admin)
router.post('/calculate-discount', async (req, res, next) => {
    try {
        const { totalAmount, eventCount } = req.body;

        if (!totalAmount || !eventCount) {
            return res.status(400).json({
                success: false,
                message: 'Please provide totalAmount and eventCount'
            });
        }

        const settings = await PaymentSettings.getActiveSettings();
        const discount = settings.calculateDiscount(totalAmount, eventCount);
        const finalAmount = totalAmount - discount;

        res.status(200).json({
            success: true,
            data: {
                totalAmount,
                eventCount,
                discount,
                finalAmount,
                discountApplied: discount > 0,
                discountDetails: settings.bulkRegistrationDiscount
            }
        });
    } catch (error) {
        next(error);
    }
});

module.exports = router;
