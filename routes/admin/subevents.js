const express = require('express');
const router = express.Router();
const SubEvent = require('../../models/SubEvent');
const Participant = require('../../models/Participant');
const { protect, authorize } = require('../../middleware/auth');

// All routes are protected and require admin role
router.use(protect);
router.use(authorize('admin'));

// @route   GET /api/admin/subevents
// @desc    Get all sub-events
// @access  Private (Admin)
router.get('/', async (req, res, next) => {
    try {
        const subEvents = await SubEvent.find().sort({ createdAt: -1 });

        res.status(200).json({
            success: true,
            count: subEvents.length,
            data: subEvents
        });
    } catch (error) {
        next(error);
    }
});

// @route   GET /api/admin/subevents/:id
// @desc    Get single sub-event
// @access  Private (Admin)
router.get('/:id', async (req, res, next) => {
    try {
        const subEvent = await SubEvent.findById(req.params.id)
            .populate('rounds');

        if (!subEvent) {
            return res.status(404).json({
                success: false,
                message: 'Sub-event not found'
            });
        }

        res.status(200).json({
            success: true,
            data: subEvent
        });
    } catch (error) {
        next(error);
    }
});

// @route   POST /api/admin/subevents
// @desc    Create new sub-event
// @access  Private (Admin)
router.post('/', async (req, res, next) => {
    try {
        const {
            name,
            description,
            type,
            groupSizeRange,
            panelCount,
            maxParticipants,
            registrationDeadline,
            startTime,
            accentColor,
            registrationPrice
        } = req.body;

        // Validate required fields
        if (!name || !description || !type) {
            return res.status(400).json({
                success: false,
                message: 'Please provide name, description, and type'
            });
        }

        // Check if sub-event with same name exists
        const existingSubEvent = await SubEvent.findOne({ name });
        if (existingSubEvent) {
            return res.status(400).json({
                success: false,
                message: 'A sub-event with this name already exists'
            });
        }

        const subEvent = await SubEvent.create({
            name,
            description,
            type,
            groupSizeRange: groupSizeRange || { min: 1, max: 10 },
            panelCount: panelCount || 1,
            maxParticipants,
            registrationDeadline,
            startTime,
            accentColor: accentColor || 'mindSaga',
            registrationPrice: registrationPrice || 50
        });

        // Emit socket event
        const io = req.app.get('io');
        io.to('admin').emit('subevent:created', {
            subEventId: subEvent._id,
            name: subEvent.name
        });

        res.status(201).json({
            success: true,
            message: 'Sub-event created successfully',
            data: subEvent
        });
    } catch (error) {
        next(error);
    }
});

// @route   PUT /api/admin/subevents/:id
// @desc    Update sub-event
// @access  Private (Admin)
router.put('/:id', async (req, res, next) => {
    try {
        const subEvent = await SubEvent.findById(req.params.id);

        if (!subEvent) {
            return res.status(404).json({
                success: false,
                message: 'Sub-event not found'
            });
        }

        const {
            name,
            description,
            type,
            groupSizeRange,
            panelCount,
            maxParticipants,
            registrationDeadline,
            startTime,
            accentColor,
            registrationPrice
        } = req.body;

        // Update fields
        if (name) subEvent.name = name;
        if (description) subEvent.description = description;
        if (type) subEvent.type = type;
        if (groupSizeRange) subEvent.groupSizeRange = groupSizeRange;
        if (panelCount) subEvent.panelCount = panelCount;
        if (maxParticipants !== undefined) subEvent.maxParticipants = maxParticipants;
        if (registrationDeadline !== undefined) subEvent.registrationDeadline = registrationDeadline;
        if (startTime !== undefined) subEvent.startTime = startTime;
        if (accentColor) subEvent.accentColor = accentColor;
        if (registrationPrice !== undefined) subEvent.registrationPrice = registrationPrice;

        await subEvent.save();

        // Emit socket event
        const io = req.app.get('io');
        io.to('admin').emit('subevent:updated', {
            subEventId: subEvent._id,
            name: subEvent.name
        });

        res.status(200).json({
            success: true,
            message: 'Sub-event updated successfully',
            data: subEvent
        });
    } catch (error) {
        next(error);
    }
});

// @route   DELETE /api/admin/subevents/:id
// @desc    Delete sub-event
// @access  Private (Admin)
router.delete('/:id', async (req, res, next) => {
    try {
        const subEvent = await SubEvent.findById(req.params.id);

        if (!subEvent) {
            return res.status(404).json({
                success: false,
                message: 'Sub-event not found'
            });
        }

        // Check if there are participants registered
        const participantCount = await Participant.countDocuments({
            registeredSubEvents: subEvent._id
        });

        if (participantCount > 0) {
            return res.status(400).json({
                success: false,
                message: `Cannot delete sub-event. ${participantCount} participants are registered.`
            });
        }

        await subEvent.deleteOne();

        // Emit socket event
        const io = req.app.get('io');
        io.to('admin').emit('subevent:deleted', {
            subEventId: subEvent._id,
            name: subEvent.name
        });

        res.status(200).json({
            success: true,
            message: 'Sub-event deleted successfully'
        });
    } catch (error) {
        next(error);
    }
});

// @route   PUT /api/admin/subevents/:id/toggle
// @desc    Toggle sub-event registration status
// @access  Private (Admin)
router.put('/:id/toggle', async (req, res, next) => {
    try {
        const subEvent = await SubEvent.findById(req.params.id);

        if (!subEvent) {
            return res.status(404).json({
                success: false,
                message: 'Sub-event not found'
            });
        }

        subEvent.isActiveForRegistration = !subEvent.isActiveForRegistration;
        await subEvent.save();

        res.status(200).json({
            success: true,
            message: `Registration ${subEvent.isActiveForRegistration ? 'enabled' : 'disabled'} for ${subEvent.name}`,
            data: subEvent
        });
    } catch (error) {
        next(error);
    }
});

// @desc    Get all approved participants for a sub-event
// @route   GET /api/admin/subevents/:id/participants
router.get('/:id/participants', async (req, res) => {
    try {
        const participants = await Participant.find({
            'registeredSubEvents': req.params.id,
            'registrationStatus': 'approved'
        }).select('fullName email prn currentStatus');

        res.json({ success: true, data: participants });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// @route   POST /api/admin/subevents/:id/start
// @desc    Manually start an event
// @access  Private (Admin)
router.post('/:id/start', async (req, res, next) => {
    try {
        const subEvent = await SubEvent.findById(req.params.id);

        if (!subEvent) {
            return res.status(404).json({
                success: false,
                message: 'Sub-event not found'
            });
        }

        if (subEvent.status === 'active') {
            return res.status(400).json({
                success: false,
                message: 'Event is already active'
            });
        }

        if (subEvent.status === 'completed') {
            return res.status(400).json({
                success: false,
                message: 'Cannot start a completed event'
            });
        }

        subEvent.status = 'active';
        subEvent.actualStartTime = new Date();
        await subEvent.save();

        // Emit socket event to notify all connected clients
        const io = req.app.get('io');
        io.emit('subevent:started', {
            subEventId: subEvent._id,
            name: subEvent.name,
            actualStartTime: subEvent.actualStartTime
        });

        res.status(200).json({
            success: true,
            message: `${subEvent.name} has been started`,
            data: subEvent
        });
    } catch (error) {
        next(error);
    }
});

// @route   POST /api/admin/subevents/:id/stop
// @desc    Manually stop an event
// @access  Private (Admin)
router.post('/:id/stop', async (req, res, next) => {
    try {
        const subEvent = await SubEvent.findById(req.params.id);

        if (!subEvent) {
            return res.status(404).json({
                success: false,
                message: 'Sub-event not found'
            });
        }

        if (subEvent.status !== 'active') {
            return res.status(400).json({
                success: false,
                message: 'Event is not currently active'
            });
        }

        subEvent.status = 'completed';
        subEvent.actualEndTime = new Date();
        await subEvent.save();

        // Emit socket event to notify all connected clients
        const io = req.app.get('io');
        io.emit('subevent:stopped', {
            subEventId: subEvent._id,
            name: subEvent.name,
            actualEndTime: subEvent.actualEndTime
        });

        res.status(200).json({
            success: true,
            message: `${subEvent.name} has been stopped`,
            data: subEvent
        });
    } catch (error) {
        next(error);
    }
});

// @route   POST /api/admin/subevents/:id/restart
// @desc    Restart a sub-event (reset status to not_started)
// @access  Private (Admin)
router.post('/:id/restart', async (req, res, next) => {
    try {
        const subEvent = await SubEvent.findById(req.params.id);

        if (!subEvent) {
            return res.status(404).json({
                success: false,
                message: 'Sub-event not found'
            });
        }

        subEvent.status = 'not_started';
        subEvent.actualStartTime = null;
        subEvent.actualEndTime = null;
        await subEvent.save();

        // Emit socket event
        const io = req.app.get('io');
        io.emit('subevent:updated', {
            subEventId: subEvent._id,
            name: subEvent.name,
            status: 'not_started'
        });

        res.status(200).json({
            success: true,
            message: `${subEvent.name} has been reset to not started`,
            data: subEvent
        });
    } catch (error) {
        next(error);
    }
});

module.exports = router;
