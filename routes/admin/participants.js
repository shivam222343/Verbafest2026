const express = require('express');
const router = express.Router();
const Participant = require('../../models/Participant');
const SubEvent = require('../../models/SubEvent');
const Round = require('../../models/Round');
const Group = require('../../models/Group');
const { protect, authorize } = require('../../middleware/auth');
const { generateParticipantCSV, generateParticipantHTML } = require('../../utils/participantExport');

// All routes are protected and require admin role
router.use(protect);
router.use(authorize('admin'));

// @route   GET /api/admin/participants
// @desc    Get all participants with filters
// @access  Private (Admin)
router.get('/', async (req, res, next) => {
    try {
        const { status, subEvent, search, page = 1, limit = 1000 } = req.query;

        // Build query
        const query = {};

        if (status) {
            query.registrationStatus = status;
        }

        if (subEvent) {
            query.registeredSubEvents = subEvent;
        }

        if (search) {
            query.$or = [
                { fullName: { $regex: search, $options: 'i' } },
                { email: { $regex: search, $options: 'i' } },
                { prn: { $regex: search, $options: 'i' } },
                { mobile: { $regex: search, $options: 'i' } }
            ];
        }

        const participants = await Participant.find(query)
            .populate('registeredSubEvents', 'name type accentColor')
            .sort({ createdAt: -1 })
            .limit(limit * 1)
            .skip((page - 1) * limit);

        const count = await Participant.countDocuments(query);

        res.status(200).json({
            success: true,
            count,
            totalPages: Math.ceil(count / limit),
            currentPage: parseInt(page),
            data: participants
        });
    } catch (error) {
        next(error);
    }
});

// @route   GET /api/admin/participants/export
// @desc    Export participants data
// @access  Private (Admin)
router.get('/export', async (req, res, next) => {
    try {
        const { status, subEvents, format = 'csv' } = req.query;

        const query = {};
        if (status) {
            query.registrationStatus = status;
        }

        if (subEvents && subEvents !== 'all') {
            const ids = Array.isArray(subEvents) ? subEvents : subEvents.split(',');
            query.registeredSubEvents = { $in: ids };
        }

        const participants = await Participant.find(query)
            .populate('registeredSubEvents', 'name')
            .sort({ chestNumber: 1 });

        // Get sub-event names for the map
        const subEventsData = await SubEvent.find({}, 'name');
        const subEventMap = {};
        subEventsData.forEach(se => {
            subEventMap[se._id.toString()] = se.name;
        });

        if (format === 'csv') {
            const csvData = generateParticipantCSV(participants, { subEventMap });
            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', `attachment; filename=participants-${Date.now()}.csv`);
            return res.status(200).send(csvData);
        } else if (format === 'html') {
            const htmlData = generateParticipantHTML(participants, {
                title: 'Exported Participant List',
                subEventMap
            });
            res.setHeader('Content-Type', 'text/html');
            return res.status(200).send(htmlData);
        }

        res.status(400).json({ success: false, message: 'Invalid format' });
    } catch (error) {
        next(error);
    }
});

// @route   GET /api/admin/participants/pending
// @desc    Get pending registrations
// @access  Private (Admin)
router.get('/pending', async (req, res, next) => {
    try {
        const participants = await Participant.find({ registrationStatus: 'pending' })
            .populate('registeredSubEvents', 'name type accentColor')
            .populate('pendingSubEvents', 'name type')
            .sort({ createdAt: -1 });

        res.status(200).json({
            success: true,
            count: participants.length,
            data: participants
        });
    } catch (error) {
        next(error);
    }
});

// @route   GET /api/admin/participants/availability
// @desc    Get real-time availability of all participants
// @access  Private (Admin)
router.get('/availability', async (req, res, next) => {
    try {
        const participants = await Participant.find({ registrationStatus: 'approved' })
            .populate('registeredSubEvents', 'name type accentColor')
            .populate('currentEvent', 'name');

        res.status(200).json({
            success: true,
            data: participants
        });
    } catch (error) {
        next(error);
    }
});

// @route   GET /api/admin/participants/:id
// @desc    Get single participant details
// @access  Private (Admin)
router.get('/:id', async (req, res, next) => {
    try {
        const participant = await Participant.findById(req.params.id)
            .populate('registeredSubEvents', 'name type accentColor');

        if (!participant) {
            return res.status(404).json({
                success: false,
                message: 'Participant not found'
            });
        }

        res.status(200).json({
            success: true,
            data: participant
        });
    } catch (error) {
        next(error);
    }
});

// @route   PUT /api/admin/participants/:id/approve
// @desc    Approve participant registration
// @access  Private (Admin)
router.put('/:id/approve', async (req, res, next) => {
    try {
        const participant = await Participant.findById(req.params.id);

        if (!participant) {
            return res.status(404).json({
                success: false,
                message: 'Participant not found'
            });
        }

        if (participant.registrationStatus === 'approved') {
            return res.status(400).json({
                success: false,
                message: 'Participant is already approved'
            });
        }

        if (participant.isReRegistration && participant.pendingSubEvents && participant.pendingSubEvents.length > 0) {
            // Merge pending sub-events into registered ones
            const newEvents = participant.pendingSubEvents.filter(id => !participant.registeredSubEvents.includes(id));
            participant.registeredSubEvents = [...participant.registeredSubEvents, ...newEvents];

            // Initialize status for new sub-events
            for (const subEventId of newEvents) {
                participant.statusPerSubEvent.set(subEventId.toString(), {
                    status: 'not_started',
                    currentRound: null,
                    roundNumber: 0
                });
            }

            // Reset re-registration flags
            participant.isReRegistration = false;
            participant.pendingSubEvents = [];
        }

        participant.registrationStatus = 'approved';
        participant.currentStatus = 'available';
        await participant.save();

        // Update sub-event approved participant counts
        if (participant.registeredSubEvents && Array.isArray(participant.registeredSubEvents)) {
            for (const subEventId of participant.registeredSubEvents) {
                const subEvent = await SubEvent.findById(subEventId);
                if (subEvent) {
                    await subEvent.updateRegistrationCount();
                }
            }
        }

        // Emit socket events for real-time updates
        const io = req.app.get('io');
        if (io) {
            io.to('admin').emit('participant:approved', {
                participantId: participant._id,
                fullName: participant.fullName,
                registrationStatus: participant.registrationStatus,
                currentStatus: participant.currentStatus
            });
            io.to(`participant:${participant._id}`).emit('participant:status_updated', {
                message: 'Your registration has been approved!',
                status: 'approved'
            });
            io.to(`participant:${participant._id}`).emit('participant:notification', {
                id: Date.now().toString(),
                type: 'approval',
                title: 'Registration Approved!',
                message: 'Congratulations! Your event registration has been approved. You can now see your assigned rounds and groups here.',
                timestamp: new Date()
            });
            io.emit('availability_update');
        }

        res.status(200).json({
            success: true,
            message: 'Participant approved successfully',
            data: participant
        });
    } catch (error) {
        console.error('Error in participant approval:', error);
        next(error);
    }
});

// @route   PUT /api/admin/participants/:id/reject
// @desc    Reject participant registration
// @access  Private (Admin)
router.put('/:id/reject', async (req, res, next) => {
    try {
        const { reason } = req.body;

        const participant = await Participant.findById(req.params.id);

        if (!participant) {
            return res.status(404).json({
                success: false,
                message: 'Participant not found'
            });
        }

        if (participant.registrationStatus === 'rejected') {
            return res.status(400).json({
                success: false,
                message: 'Participant is already rejected'
            });
        }

        participant.registrationStatus = 'rejected';
        if (reason) {
            participant.adminNotes = reason;
        }
        await participant.save();

        // Emit socket event
        const io = req.app.get('io');
        if (io) {
            io.to('admin').emit('participant:rejected', {
                participantId: participant._id,
                fullName: participant.fullName
            });
            io.to(`participant:${participant._id}`).emit('participant:status_updated', {
                message: 'Your registration was not approved. Please check notes or contact admin.',
                status: 'rejected'
            });
            io.to(`participant:${participant._id}`).emit('participant:notification', {
                id: Date.now().toString(),
                type: 'rejection',
                title: 'Registration Status Update',
                message: reason ? `Your registration was not approved. Reason: ${reason}` : 'Your registration was not approved. Please contact the administrator for details.',
                timestamp: new Date()
            });
        }

        res.status(200).json({
            success: true,
            message: 'Participant rejected',
            data: participant
        });
    } catch (error) {
        next(error);
    }
});

// @route   PUT /api/admin/participants/:id/registration-status
// @desc    Update participant registration status manually
// @access  Private (Admin)
router.put('/:id/registration-status', async (req, res, next) => {
    try {
        const { status } = req.body;
        const participant = await Participant.findById(req.params.id);

        if (!participant) {
            return res.status(404).json({ success: false, message: 'Participant not found' });
        }

        participant.registrationStatus = status;
        if (status === 'approved') participant.currentStatus = 'available';
        await participant.save();

        res.status(200).json({
            success: true,
            message: `Registration status updated to ${status}`,
            data: participant
        });
    } catch (error) {
        next(error);
    }
});

// @route   PUT /api/admin/participants/:id/current-status
// @desc    Update participant current availability status manually
// @access  Private (Admin)
router.put('/:id/current-status', async (req, res, next) => {
    try {
        const { status } = req.body;
        const participant = await Participant.findById(req.params.id);

        if (!participant) {
            return res.status(404).json({ success: false, message: 'Participant not found' });
        }

        participant.currentStatus = status;
        await participant.save();

        // Emit socket update
        const io = req.app.get('io');
        if (io) io.emit('availability_update');

        res.status(200).json({
            success: true,
            message: `Current status updated to ${status}`,
            data: participant
        });
    } catch (error) {
        next(error);
    }
});

// @route   DELETE /api/admin/participants/:id
// @desc    Delete participant
// @access  Private (Admin)
router.delete('/:id', async (req, res, next) => {
    try {
        const participant = await Participant.findById(req.params.id);

        if (!participant) {
            return res.status(404).json({ success: false, message: 'Participant not found' });
        }

        // Check if participant is in any group/round if needed, but let's just delete for now
        await participant.deleteOne();

        res.status(200).json({
            success: true,
            message: 'Participant deleted successfully'
        });
    } catch (error) {
        next(error);
    }
});

// @route   GET /api/admin/participants/:id/history
// @desc    Get participant performance history across rounds
// @access  Private (Admin)
router.get('/:id/history', async (req, res, next) => {
    try {
        const participantId = req.params.id;

        // Find all rounds where this participant was a member
        const rounds = await Round.find({ participants: participantId })
            .populate('subEvent', 'name')
            .sort({ createdAt: 1 });

        const history = [];

        for (const round of rounds) {
            // Find if participant was in a group in this round
            const group = await Group.findOne({
                roundId: round._id,
                participants: participantId
            });

            let status = 'shortlisted';
            if (round.status === 'completed') {
                const isWinner = round.winners.some(id => id.toString() === participantId.toString());
                status = isWinner ? 'qualified' : (round.isElimination ? 'eliminated' : 'completed');
            } else if (round.status === 'active') {
                status = 'active';
            }

            history.push({
                roundId: round._id,
                roundName: round.name,
                roundNumber: round.roundNumber,
                subEventId: round.subEvent._id,
                subEventName: round.subEvent.name,
                status,
                groupName: group ? group.groupName : null,
                date: round.startTime || round.createdAt
            });
        }

        res.status(200).json({
            success: true,
            data: history
        });
    } catch (error) {
        next(error);
    }
});

// @route   PUT /api/admin/participants/subevent/:subeventId/make-all-available
// @desc    Update all participants of a subevent to available status
// @access  Private (Admin)
router.put('/subevent/:subeventId/make-all-available', async (req, res, next) => {
    try {
        const { subeventId } = req.params;
        await Participant.updateMany(
            { registeredSubEvents: subeventId, registrationStatus: 'approved' },
            { currentStatus: 'available' }
        );

        // Emit socket update
        const io = req.app.get('io');
        if (io) io.emit('availability_update');

        res.status(200).json({
            success: true,
            message: `All participants for this event are now marked as available`
        });
    } catch (error) {
        next(error);
    }
});

module.exports = router;
