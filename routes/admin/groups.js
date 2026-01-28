const express = require('express');
const router = express.Router();
const Group = require('../../models/Group');
const Panel = require('../../models/Panel');
const Participant = require('../../models/Participant');
const SubEvent = require('../../models/SubEvent');
const Round = require('../../models/Round');
const { protect, authorize } = require('../../middleware/auth');
const { generateGroupPDF, generateGroupHTML } = require('../../utils/groupExport');

// All routes are protected and require admin role
router.use(protect);
router.use(authorize('admin'));

// @route   POST /api/admin/groups
// @desc    Create a group manually
// @access  Private (Admin)
router.post('/', async (req, res, next) => {
    try {
        const { subEventId, roundId, participantIds, groupName } = req.body;

        if (!subEventId || !roundId || !participantIds || participantIds.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Please provide all required fields'
            });
        }

        // Check if any of these participants are already in a group for this round
        const existingGroups = await Group.find({ roundId });
        const assignedIds = new Set(existingGroups.flatMap(g => g.participants.map(p => p.toString())));
        const duplicates = participantIds.filter(id => assignedIds.has(id.toString()));

        if (duplicates.length > 0) {
            return res.status(400).json({
                success: false,
                message: 'One or more participants are already assigned to another group in this round'
            });
        }

        // Get current max group number for this round
        const lastGroup = await Group.findOne({ roundId }).sort({ groupNumber: -1 });
        const groupNumber = lastGroup ? lastGroup.groupNumber + 1 : 1;

        const group = await Group.create({
            subEventId,
            roundId,
            groupNumber,
            groupName: groupName || `Group ${groupNumber}`,
            participants: participantIds
        });

        res.status(201).json({
            success: true,
            message: 'Group created successfully',
            data: group
        });
    } catch (error) {
        next(error);
    }
});

// @route   POST /api/admin/groups/auto-form
// @desc    Auto-form groups based on participant availability
// @access  Private (Admin)
router.post('/auto-form', async (req, res, next) => {
    try {
        const { subEventId, roundId, groupSize } = req.body;

        // Validate inputs
        if (!subEventId || !roundId) {
            return res.status(400).json({
                success: false,
                message: 'Please provide subEventId and roundId'
            });
        }

        const subEvent = await SubEvent.findById(subEventId);
        const round = await Round.findById(roundId);

        if (!subEvent || !round) {
            return res.status(404).json({
                success: false,
                message: 'SubEvent or Round not found'
            });
        }

        // Check if event type is group
        if (subEvent.type !== 'group') {
            return res.status(400).json({
                success: false,
                message: 'This sub-event is not a group event'
            });
        }

        // Get participants for this round
        let participantQuery = {
            _id: { $in: round.participants },
            currentStatus: { $in: ['available', 'qualified'] }
        };

        // Fallback for Round 1 if no participants are shortlisted yet
        if (round.roundNumber === 1 && (!round.participants || round.participants.length === 0)) {
            participantQuery = {
                registeredSubEvents: subEventId,
                registrationStatus: 'approved',
                currentStatus: { $in: ['available', 'qualified'] }
            };
        } else if (round.roundNumber > 1 && (!round.participants || round.participants.length === 0)) {
            // Find the previous round to get its winners
            const prevRound = await Round.findOne({
                subEvent: subEventId,
                roundNumber: round.roundNumber - 1
            });

            if (prevRound && prevRound.winners && prevRound.winners.length > 0) {
                participantQuery = {
                    _id: { $in: prevRound.winners },
                    currentStatus: { $in: ['available', 'qualified'] }
                };
            }
        }

        // Check for participants already in a group for this round
        const existingGroups = await Group.find({ roundId });
        const assignedParticipantIds = existingGroups.reduce((acc, curr) => {
            return acc.concat(curr.participants.map(p => p.toString()));
        }, []);

        const participants = await Participant.find({
            ...participantQuery,
            _id: participantQuery._id
                ? { ...participantQuery._id, $nin: assignedParticipantIds }
                : { $nin: assignedParticipantIds }
        });

        if (participants.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'No unassigned participants available for this round'
            });
        }

        // Determine group size
        const minSize = subEvent.groupSizeRange?.min || 2;
        const maxSize = subEvent.groupSizeRange?.max || 5;
        const targetSize = groupSize || Math.floor((minSize + maxSize) / 2);

        // Shuffle participants for random grouping
        const shuffled = participants.sort(() => 0.5 - Math.random());

        // Form groups
        const groups = [];
        let groupNumber = 1;

        // Get current max group number for this round to avoid collision
        const lastGroup = await Group.findOne({ roundId }).sort({ groupNumber: -1 });
        if (lastGroup) groupNumber = lastGroup.groupNumber + 1;

        for (let i = 0; i < shuffled.length; i += targetSize) {
            const groupParticipants = shuffled.slice(i, i + targetSize);

            // If this is the last batch and it's too small, distribute instead of creating
            if (groupParticipants.length < minSize && groups.length > 0) {
                // Distribute remaining participants to existing groups formed in THIS call
                console.log(`Distributing ${groupParticipants.length} remaining participants to earlier groups`);
                for (let j = 0; j < groupParticipants.length; j++) {
                    const groupToAddTo = groups[j % groups.length];
                    groupToAddTo.participants.push(groupParticipants[j]._id);
                    await groupToAddTo.save();
                }
                break;
            }

            // Fallback: If we have very few participants and can't even form ONE min-sized group,
            // but we have at least ONE participant, create a single group anyway.
            if (groupParticipants.length < minSize && groups.length === 0 && groupParticipants.length > 0) {
                console.log(`Pool too small (${groupParticipants.length} < ${minSize}), forming one small group anyway.`);
                // We create the group below normally
            } else if (groupParticipants.length === 0 && groups.length === 0) {
                console.log('No participants to form any group');
                return res.status(400).json({
                    success: false,
                    message: 'No unassigned participants available'
                });
            }

            const group = await Group.create({
                subEventId,
                roundId,
                groupNumber: groupNumber++,
                groupName: `Group ${groupNumber - 1}`,
                participants: groupParticipants.map(p => p._id)
            });

            groups.push(group);
        }

        res.status(201).json({
            success: true,
            message: `Successfully formed ${groups.length} groups`,
            data: groups
        });
    } catch (error) {
        next(error);
    }
});

// @route   GET /api/admin/groups/round/:roundId
// @desc    Get all groups for a round
// @access  Private (Admin)
router.get('/round/:roundId', async (req, res, next) => {
    try {
        const groups = await Group.find({ roundId: req.params.roundId })
            .populate('participants', 'fullName email prn currentStatus chestNumber')
            .populate('panelId', 'panelName panelNumber')
            .sort({ groupNumber: 1 });

        res.status(200).json({
            success: true,
            count: groups.length,
            data: groups
        });
    } catch (error) {
        next(error);
    }
});

// @route   PUT /api/admin/groups/:id
// @desc    Update group (add/remove participants, assign panel)
// @access  Private (Admin)
router.put('/:id', async (req, res, next) => {
    try {
        const { participants, panelId, groupName } = req.body;

        const group = await Group.findById(req.params.id);
        if (!group) {
            return res.status(404).json({
                success: false,
                message: 'Group not found'
            });
        }

        if (participants) group.participants = participants;
        if (panelId !== undefined) group.panelId = panelId;
        if (groupName) group.groupName = groupName;

        await group.save();

        const updatedGroup = await Group.findById(group._id)
            .populate('participants', 'fullName email prn')
            .populate('panelId', 'panelName');

        res.status(200).json({
            success: true,
            message: 'Group updated successfully',
            data: updatedGroup
        });
    } catch (error) {
        next(error);
    }
});

// @route   DELETE /api/admin/groups/:id
// @desc    Delete a group
// @access  Private (Admin)
router.delete('/:id', async (req, res, next) => {
    try {
        const group = await Group.findById(req.params.id);
        if (!group) {
            return res.status(404).json({
                success: false,
                message: 'Group not found'
            });
        }

        await group.deleteOne();

        res.status(200).json({
            success: true,
            message: 'Group deleted successfully'
        });
    } catch (error) {
        next(error);
    }
});

// @route   POST /api/admin/groups/:id/assign-panel
// @desc    Assign group to a panel
// @access  Private (Admin)
router.post('/:id/assign-panel', async (req, res, next) => {
    try {
        const { panelId } = req.body;

        const group = await Group.findById(req.params.id);
        if (!group) {
            return res.status(404).json({
                success: false,
                message: 'Group not found'
            });
        }

        const panel = await Panel.findById(panelId);
        if (!panel) {
            return res.status(404).json({
                success: false,
                message: 'Panel not found'
            });
        }

        group.panelId = panelId;
        await group.save();

        // Add group to panel's assigned groups
        if (!panel.assignedGroups.includes(group._id)) {
            panel.assignedGroups.push(group._id);
            await panel.save();
        }

        res.status(200).json({
            success: true,
            message: 'Group assigned to panel successfully',
            data: group
        });
    } catch (error) {
        next(error);
    }
});

// @route   POST /api/admin/groups/confirm-selections
// @desc    Admin confirms judge selections for next round
// @access  Private (Admin)
router.post('/confirm-selections', async (req, res, next) => {
    try {
        const { roundId, selectedGroupIds } = req.body;

        if (!roundId || !selectedGroupIds || !Array.isArray(selectedGroupIds)) {
            return res.status(400).json({
                success: false,
                message: 'Please provide roundId and selectedGroupIds array'
            });
        }

        // Update selected groups
        await Group.updateMany(
            { _id: { $in: selectedGroupIds } },
            {
                selectedForNextRound: true,
                adminConfirmed: true
            }
        );

        // Update non-selected groups
        await Group.updateMany(
            {
                roundId,
                _id: { $nin: selectedGroupIds }
            },
            {
                selectedForNextRound: false,
                adminConfirmed: true
            }
        );

        res.status(200).json({
            success: true,
            message: `Confirmed ${selectedGroupIds.length} groups for next round`
        });
    } catch (error) {
        next(error);
    }
});

router.post('/:id/notify', async (req, res, next) => {
    try {
        const group = await Group.findById(req.params.id)
            .populate('participants')
            .populate('roundId')
            .populate('panelId')
            .populate('subEventId');

        if (!group) {
            return res.status(404).json({
                success: false,
                message: 'Group not found'
            });
        }

        const io = req.app.get('io');
        const subEventName = group.subEventId?.name || 'Event';
        const venue = group.panelId?.venue || group.roundId?.venue || 'the designated venue';

        // Update each participant's status and send personalized notification
        for (const participant of group.participants) {
            // Update sub-event status to 'active' (member started)
            if (group.subEventId) {
                const subEventIdStr = group.subEventId._id.toString();
                const currentStatus = participant.statusPerSubEvent.get(subEventIdStr) || {};

                participant.statusPerSubEvent.set(subEventIdStr, {
                    ...currentStatus,
                    status: 'active',
                    currentRound: group.roundId?._id,
                    roundNumber: group.roundId?.roundNumber || currentStatus.roundNumber
                });

                // Update global status
                participant.currentStatus = 'busy';
                participant.currentEvent = group.subEventId._id;
                await participant.save();
            }

            const notification = {
                id: Date.now().toString() + participant._id,
                type: 'group_info',
                title: `Report for ${subEventName}`,
                message: `Hello ${participant.fullName}, please reach at ${venue} asap it will start in 2 minutes. Late reaching will be not allowed.`,
                location: venue,
                groupName: group.groupName,
                roundName: group.roundId?.name,
                subEventName: subEventName,
                timestamp: new Date()
            };

            // Emit to participant's room
            io.to(`participant:${participant._id}`).emit('participant:notification', notification);

            // Also emit status updated for real-time dashboard refresh
            io.to(`participant:${participant._id}`).emit('participant:status_updated', {
                message: `Your round for ${subEventName} is starting now!`,
                status: 'busy'
            });
        }

        res.status(200).json({
            success: true,
            message: `Notification sent and status updated for ${group.participants.length} members`,
            data: { venue, subEvent: subEventName }
        });
    } catch (error) {
        next(error);
    }
});

// @route   GET /api/admin/groups/export/:type
// @desc    Export groups as PDF or HTML
// @access  Private (Admin)
router.get('/export/:format', async (req, res, next) => {
    try {
        const { format } = req.params;
        const { groupIds } = req.query;

        if (!groupIds) {
            return res.status(400).json({ success: false, message: 'Please provide groupIds' });
        }

        const ids = groupIds.split(',');
        const groups = await Group.find({ _id: { $in: ids } })
            .populate('participants', 'fullName email prn currentStatus chestNumber')
            .populate('panelId')
            .sort({ groupNumber: 1 });

        if (format === 'pdf') {
            const doc = generateGroupPDF(groups);
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `attachment; filename=groups-export-${Date.now()}.pdf`);
            doc.pipe(res);
            doc.end();
        } else if (format === 'html') {
            const html = generateGroupHTML(groups);
            res.setHeader('Content-Type', 'text/html');
            res.send(html);
        } else {
            res.status(400).json({ success: false, message: 'Invalid export format' });
        }
    } catch (error) {
        next(error);
    }
});

module.exports = router;
