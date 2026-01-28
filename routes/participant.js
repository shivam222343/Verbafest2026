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
                currentStatus: participant.currentStatus,
                registeredSubEvents: enrichedSubEvents
            }
        });
    } catch (error) {
        next(error);
    }
});

module.exports = router;
