const express = require('express');
const router = express.Router();
const Participant = require('../../models/Participant');
const SubEvent = require('../../models/SubEvent');
const Round = require('../../models/Round');
const { protect, authorize } = require('../../middleware/auth');

router.use(protect);
router.use(authorize('admin'));

// @desc    Get global analytics dashboard
// @route   GET /api/admin/analytics
router.get('/', async (req, res) => {
    try {
        const [participants, subEvents, rounds] = await Promise.all([
            Participant.find(),
            SubEvent.find(),
            Round.find()
        ]);

        // Registration trends (by date)
        const registrationTrends = participants.reduce((acc, p) => {
            const date = p.createdAt.toISOString().split('T')[0];
            acc[date] = (acc[date] || 0) + 1;
            return acc;
        }, {});

        const trendData = Object.entries(registrationTrends)
            .map(([date, count]) => ({ date, count }))
            .sort((a, b) => a.date.localeCompare(b.date));

        // Distribution by Status
        const statusDistribution = [
            { name: 'Available', value: participants.filter(p => p.currentStatus === 'available').length },
            { name: 'Busy', value: participants.filter(p => p.currentStatus === 'busy').length },
            { name: 'Waiting', value: participants.filter(p => p.currentStatus === 'registered').length },
            { name: 'Rejected', value: participants.filter(p => p.registrationStatus === 'rejected').length },
        ];

        // Sub-event popularity
        const subEventPop = subEvents.map(se => ({
            name: se.name,
            registrations: participants.filter(p =>
                p.registeredSubEvents.includes(se._id) && p.registrationStatus === 'approved'
            ).length,
            capacity: se.maxParticipants || 0
        })).sort((a, b) => b.registrations - a.registrations);

        res.json({
            success: true,
            data: {
                totalParticipants: participants.length,
                approvedParticipants: participants.filter(p => p.registrationStatus === 'approved').length,
                totalSubEvents: subEvents.length,
                activeRounds: rounds.filter(r => r.status === 'active').length,
                trendData,
                statusDistribution,
                subEventPop
            }
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

module.exports = router;
