const express = require('express');
const router = express.Router();
const PaymentSettings = require('../models/PaymentSettings');

// @route   GET /api/payment-settings
// @desc    Get active payment settings (public)
// @access  Public
router.get('/', async (req, res, next) => {
    try {
        const settings = await PaymentSettings.getActiveSettings();

        // Return only public fields
        res.status(200).json({
            success: true,
            data: {
                upiId: settings.upiId,
                accountName: settings.accountName,
                qrCodeEnabled: settings.qrCodeEnabled,
                paymentInstructions: settings.paymentInstructions,
                bulkDiscount: {
                    enabled: settings.bulkRegistrationDiscount.enabled,
                    minEvents: settings.bulkRegistrationDiscount.minEvents,
                    discountType: settings.bulkRegistrationDiscount.discountType,
                    discountValue: settings.bulkRegistrationDiscount.discountValue
                }
            }
        });
    } catch (error) {
        next(error);
    }
});

// @route   POST /api/payment-settings/calculate-discount
// @desc    Calculate discount for registration (public)
// @access  Public
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
                discountPercentage: settings.bulkRegistrationDiscount.discountValue,
                minEventsRequired: settings.bulkRegistrationDiscount.minEvents
            }
        });
    } catch (error) {
        next(error);
    }
});

module.exports = router;
