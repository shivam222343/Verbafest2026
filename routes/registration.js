const express = require('express');
const router = express.Router();
const SubEvent = require('../models/SubEvent');
const Participant = require('../models/Participant');
const { uploadPaymentProof } = require('../middleware/upload');

const SystemSettings = require('../models/SystemSettings');
const PaymentSettings = require('../models/PaymentSettings');

// @route   POST /api/registration/upload-proof
// @desc    Upload payment proof immediately
// @access  Public
router.post('/upload-proof', uploadPaymentProof.single('paymentProof'), async (req, res, next) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, message: 'Please upload a file' });
        }
        res.status(200).json({
            success: true,
            url: req.file.path
        });
    } catch (error) {
        next(error);
    }
});

// @route   GET /api/registration/payment-settings
// @desc    Get payment settings for re-registration
// @access  Public
router.get('/payment-settings', async (req, res, next) => {
    try {
        const paymentSettings = await PaymentSettings.getActiveSettings();
        const systemSettings = await SystemSettings.findOne({ key: 'core_settings' })
            .select('allEventsQrCodeUrl twoEventsQrCodeUrl singleEventQrCodeUrl comboPrice');

        res.status(200).json({
            success: true,
            data: {
                upiId: paymentSettings.upiId,
                accountName: paymentSettings.accountName,
                singleEventQrCodeUrl: systemSettings?.singleEventQrCodeUrl,
                twoEventsQrCodeUrl: systemSettings?.twoEventsQrCodeUrl,
                allEventsQrCodeUrl: systemSettings?.allEventsQrCodeUrl,
                basePrice: systemSettings?.comboPrice || 100,
                bulkDiscount: paymentSettings.bulkRegistrationDiscount.enabled
                    ? paymentSettings.bulkRegistrationDiscount.discountValue
                    : 0,
                // Add bank details from system settings if available
                accountNumber: systemSettings?.accountNumber || 'Not configured',
                ifscCode: systemSettings?.ifscCode || 'Not configured',
                bankName: systemSettings?.bankName || 'Not configured'
            }
        });
    } catch (error) {
        next(error);
    }
});

// @route   GET /api/registration/settings
// @desc    Get public system settings (event name, QR code, etc.)
// @access  Public
router.get('/settings', async (req, res, next) => {
    try {
        let settings = await SystemSettings.findOne({ key: 'core_settings' })
            .select('eventName eventDate registrationDeadline isRegistrationOpen pauseRegistrations singleEventQrCodeUrl twoEventsQrCodeUrl allEventsQrCodeUrl contactEmail availableStreams availableColleges comboPrice showSubEventsOnPublicPage publicSubEventsBannerUrl');

        if (!settings) {
            settings = {
                eventName: 'VerbaFest 2026',
                isRegistrationOpen: true,
                pauseRegistrations: false,
                availableStreams: ['Computer Science and Engineering'],
                availableColleges: ["Kit's college of enginnering, Kolhapur"]
            };
        }

        res.status(200).json({
            success: true,
            data: settings
        });
    } catch (error) {
        next(error);
    }
});

// @route   GET /api/registration/form
// @desc    Get active sub-events for registration form
// @access  Public
router.get('/form', async (req, res, next) => {
    try {
        const subEvents = await SubEvent.find({
            isActiveForRegistration: true,
            $or: [
                { registrationDeadline: null },
                { registrationDeadline: { $gte: new Date() } }
            ]
        }).select('name description type accentColor maxParticipants approvedParticipants registrationPrice');

        res.status(200).json({
            success: true,
            count: subEvents.length,
            data: subEvents
        });
    } catch (error) {
        next(error);
    }
});

// @route   POST /api/registration/submit
// @desc    Submit participant registration
// @access  Public
router.post('/submit', async (req, res, next) => {
    try {
        const {
            fullName,
            email,
            mobile,
            prn,
            branch,
            year,
            college,
            selectedSubEvents, // Array of sub-event IDs
            transactionId,
            paidAmount,
            paymentProofUrl
        } = req.body;

        // Check if registrations are paused
        const systemSettings = await SystemSettings.findOne({ key: 'core_settings' });
        if (systemSettings?.pauseRegistrations) {
            return res.status(403).json({
                success: false,
                message: 'Registrations are currently closed as per admin instructions.'
            });
        }

        // Validate required fields
        if (!fullName || !email || !mobile || !prn || !branch || !year || !college || !transactionId) {
            return res.status(400).json({
                success: false,
                message: 'Please provide all required fields (Name, Email, Mobile, PRN, Branch, Year, College, Transaction ID)'
            });
        }

        // Validate sub-events selection
        if (!selectedSubEvents || selectedSubEvents.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Please select at least one sub-event'
            });
        }

        // selectedSubEvents is already an array from JSON
        const subEventIds = selectedSubEvents;

        // Validate payment proof URL
        if (!paymentProofUrl) {
            return res.status(400).json({
                success: false,
                message: 'Please upload payment proof'
            });
        }

        // Check if email, PRN, or Mobile already exists
        const existingParticipant = await Participant.findOne({
            $or: [
                { email },
                { prn: prn ? prn.toUpperCase() : null },
                { mobile }
            ]
        });

        if (existingParticipant) {
            let field = 'email';
            if (existingParticipant.prn === prn?.toUpperCase()) field = 'PRN';
            if (existingParticipant.mobile === mobile) field = 'Mobile Number';

            return res.status(400).json({
                success: false,
                message: `A participant with this ${field} already exists`
            });
        }

        // Verify all sub-events exist and are active
        const subEvents = await SubEvent.find({
            _id: { $in: subEventIds },
            isActiveForRegistration: true
        });

        if (subEvents.length !== subEventIds.length) {
            return res.status(400).json({
                success: false,
                message: 'One or more selected sub-events are not available for registration'
            });
        }

        // Check if any event is full
        for (const event of subEvents) {
            if (event.maxParticipants && event.approvedParticipants >= event.maxParticipants) {
                return res.status(400).json({
                    success: false,
                    message: `${event.name} has reached maximum capacity`
                });
            }
        }

        // Validate Amount with PaymentSettings
        const PaymentSettings = require('../models/PaymentSettings');
        const paymentSettings = await PaymentSettings.getActiveSettings();

        const calculatedSubtotal = subEvents.reduce((total, event) => total + (event.registrationPrice || 50), 0);
        const calculatedDiscount = paymentSettings.calculateDiscount(calculatedSubtotal, subEvents.length);
        const expectedAmount = Math.max(0, calculatedSubtotal - calculatedDiscount);

        // We allow a small margin or just check if it's at least the expected amount
        if (parseFloat(paidAmount) < expectedAmount) {
            return res.status(400).json({
                success: false,
                message: `Invalid payment amount. Expected at least ₹${expectedAmount}`
            });
        }

        // Use mobile number as password for easier login
        const generatedPassword = mobile;

        // Create participant
        const participant = await Participant.create({
            fullName,
            email,
            mobile,
            prn: prn ? prn.toUpperCase() : undefined,
            branch,
            year: parseInt(year),
            college,
            registeredSubEvents: subEventIds,
            transactionId,
            paidAmount,
            paymentProofUrl: paymentProofUrl,
            registrationStatus: 'pending',
            password: generatedPassword
        });

        // Initialize status for each sub-event
        for (const subEventId of subEventIds) {
            participant.statusPerSubEvent.set(subEventId.toString(), {
                status: 'not_started',
                currentRound: null,
                roundNumber: 0
            });
        }
        await participant.save();

        // Update sub-event registration counts
        await SubEvent.updateMany(
            { _id: { $in: subEventIds } },
            { $inc: { totalRegistrations: 1 } }
        );

        res.status(201).json({
            success: true,
            message: 'Registration submitted successfully. Please wait for admin approval.',
            data: {
                participant: {
                    id: participant._id,
                    fullName: participant.fullName,
                    email: participant.email,
                    prn: participant.prn,
                    registrationStatus: participant.registrationStatus,
                    password: generatedPassword, // Return the plain password once
                    registeredSubEvents: subEvents.map(event => ({
                        _id: event._id,
                        name: event.name,
                        whatsappGroupLink: event.whatsappGroupLink
                    }))
                }
            }
        });
    } catch (error) {
        next(error);
    }
});

// @route   GET /api/registration/status/:id
// @desc    Check registration status
// @access  Public
router.get('/status/:id', async (req, res, next) => {
    try {
        const participant = await Participant.findById(req.params.id)
            .populate('registeredSubEvents', 'name type accentColor')
            .select('-paymentProofUrl -transactionId');

        if (!participant) {
            return res.status(404).json({
                success: false,
                message: 'Registration not found'
            });
        }

        res.status(200).json({
            success: true,
            data: {
                fullName: participant.fullName,
                email: participant.email,
                prn: participant.prn,
                registrationStatus: participant.registrationStatus,
                registeredSubEvents: participant.registeredSubEvents,
                createdAt: participant.createdAt
            }
        });
    } catch (error) {
        next(error);
    }
});

module.exports = router;
