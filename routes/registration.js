const express = require('express');
const router = express.Router();
const SubEvent = require('../models/SubEvent');
const Participant = require('../models/Participant');
const { uploadPaymentProof } = require('../middleware/upload');

const SystemSettings = require('../models/SystemSettings');

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

// @route   GET /api/registration/settings
// @desc    Get public system settings (event name, QR code, etc.)
// @access  Public
router.get('/settings', async (req, res, next) => {
    try {
        const settings = await SystemSettings.findOne({ key: 'core_settings' })
            .select('eventName eventDate registrationDeadline isRegistrationOpen singleEventQrCodeUrl allEventsQrCodeUrl contactEmail availableStreams availableColleges comboPrice');

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

        // Filter out full events
        const availableEvents = subEvents.filter(event => {
            if (!event.maxParticipants) return true;
            return event.approvedParticipants < event.maxParticipants;
        });

        res.status(200).json({
            success: true,
            count: availableEvents.length,
            data: availableEvents
        });
    } catch (error) {
        next(error);
    }
});

// @route   POST /api/registration/submit
// @desc    Submit participant registration
// @access  Public
router.post('/submit', uploadPaymentProof.single('paymentProof'), async (req, res, next) => {
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
            paidAmount
        } = req.body;

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

        // Parse selectedSubEvents if it's a string
        const subEventIds = typeof selectedSubEvents === 'string'
            ? JSON.parse(selectedSubEvents)
            : selectedSubEvents;

        // Validate payment proof
        const finalPaymentProofUrl = req.file ? req.file.path : req.body.paymentProofUrl;
        if (!finalPaymentProofUrl) {
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

        // Generate a random password for the participant
        const generatedPassword = Math.random().toString(36).slice(-8).toUpperCase();

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
            paymentProofUrl: finalPaymentProofUrl,
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
                    password: generatedPassword // Return the plain password once
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
