const express = require('express');
const router = express.Router();
const Participant = require('../models/Participant');
const SubEvent = require('../models/SubEvent');
const Round = require('../models/Round');
const { protect } = require('../middleware/auth');

// @route   GET /api/participant/me
// @desc    Get current participant profile and status
// @access  Private (Participant)
router.get('/me', protect, async (req, res, next) => {
    try {
        if (req.user.role !== 'participant') {
            return res.status(403).json({
                success: false,
                message: 'Access denied. Participant only route.'
            });
        }

        const participant = await Participant.findById(req.user.id)
            .populate({
                path: 'registeredSubEvents',
                select: 'name description type accentColor status'
            });

        if (!participant) {
            return res.status(404).json({
                success: false,
                message: 'Participant record not found'
            });
        }

        // Enhance sub-events with real-time status and current round info
        const enrichedSubEvents = await Promise.all(participant.registeredSubEvents.map(async (subEvent) => {
            const statusInfo = participant.getSubEventStatus(subEvent._id);

            let roundInfo = null;
            if (statusInfo.currentRound) {
                roundInfo = await Round.findById(statusInfo.currentRound)
                    .select('name roundNumber venue instructions status');
            }

            return {
                ...subEvent.toObject(),
                myStatus: statusInfo.status,
                myRoundNumber: statusInfo.roundNumber,
                currentRound: roundInfo
            };
        }));

        res.status(200).json({
            success: true,
            data: {
                id: participant._id,
                fullName: participant.fullName,
                email: participant.email,
                mobile: participant.mobile,
                prn: participant.prn,
                branch: participant.branch,
                year: participant.year,
                college: participant.college,
                registrationStatus: participant.registrationStatus,
                rejectionReason: participant.rejectionReason,
                paidAmount: participant.paidAmount,
                currentStatus: participant.currentStatus,
                registeredSubEvents: enrichedSubEvents
            }
        });
    } catch (error) {
        next(error);
    }
});

// @route   POST /api/participant/resubmit-payment
// @desc    Resubmit payment details for rejected participants
// @access  Private (Participant)
router.post('/resubmit-payment', protect, async (req, res, next) => {
    try {
        if (req.user.role !== 'participant') {
            return res.status(403).json({
                success: false,
                message: 'Access denied. Participant only route.'
            });
        }

        const { subEventIds, transactionId, paymentProofUrl } = req.body;

        // Validation
        if (!subEventIds || !Array.isArray(subEventIds) || subEventIds.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Please select at least one sub-event'
            });
        }

        if (!transactionId || !paymentProofUrl) {
            return res.status(400).json({
                success: false,
                message: 'Transaction ID and payment proof are required'
            });
        }

        const participant = await Participant.findById(req.user.id);

        if (!participant) {
            return res.status(404).json({
                success: false,
                message: 'Participant not found'
            });
        }

        // Only allow resubmission if rejected
        if (participant.registrationStatus !== 'rejected') {
            return res.status(400).json({
                success: false,
                message: 'Payment resubmission is only allowed for rejected registrations'
            });
        }

        // Verify all sub-events exist
        const subEvents = await SubEvent.find({ _id: { $in: subEventIds } });
        if (subEvents.length !== subEventIds.length) {
            return res.status(400).json({
                success: false,
                message: 'One or more selected events are invalid'
            });
        }

        // Update participant with new payment details
        participant.registeredSubEvents = subEventIds;
        participant.transactionId = transactionId;
        participant.paymentProofUrl = paymentProofUrl;
        participant.registrationStatus = 'pending'; // Reset to pending for admin review
        participant.rejectionReason = undefined; // Clear rejection reason

        await participant.save();

        res.status(200).json({
            success: true,
            message: 'Payment details resubmitted successfully. Waiting for admin approval.',
            data: {
                registrationStatus: participant.registrationStatus,
                registeredSubEvents: participant.registeredSubEvents
            }
        });
    } catch (error) {
        next(error);
    }
});

module.exports = router;
