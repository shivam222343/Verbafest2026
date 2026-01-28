const express = require('express');
const router = express.Router();
const Round = require('../../models/Round');
const SubEvent = require('../../models/SubEvent');
const Participant = require('../../models/Participant');

// @desc    Get all rounds for a sub-event
// @route   GET /api/admin/rounds/subevent/:subEventId
router.get('/subevent/:subEventId', async (req, res) => {
    try {
        const rounds = await Round.find({ subEvent: req.params.subEventId })
            .populate('participants', 'fullName email prn currentStatus attendance')
            .populate('winners', 'fullName email prn currentStatus attendance')
            .sort({ roundNumber: 1 });

        res.json({ success: true, data: rounds });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// @desc    Get single round details
// @route   GET /api/admin/rounds/:id
router.get('/:id', async (req, res) => {
    try {
        const round = await Round.findById(req.params.id)
            .populate('participants', 'fullName email prn currentStatus attendance')
            .populate('winners', 'fullName email prn currentStatus attendance');

        if (!round) {
            return res.status(404).json({ success: false, message: 'Round not found' });
        }

        res.json({ success: true, data: round });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// @desc    Create a new round for a sub-event
// @route   POST /api/admin/rounds
router.post('/', async (req, res) => {
    try {
        const { subEventId, roundNumber, name, isElimination, venue, instructions } = req.body;

        const subEvent = await SubEvent.findById(subEventId);
        if (!subEvent) {
            return res.status(404).json({ success: false, message: 'Sub-event not found' });
        }

        // For Round 1, automatically shortlist all approved participants
        let initialParticipants = [];
        if (roundNumber === 1 || roundNumber === '1') {
            const approvals = await Participant.find({
                registeredSubEvents: subEventId,
                registrationStatus: 'approved'
            });
            initialParticipants = approvals.map(p => p._id);
        }

        const round = await Round.create({
            subEvent: subEventId,
            roundNumber,
            name,
            type: subEvent.type,
            isElimination,
            venue,
            instructions,
            participants: initialParticipants
        });

        res.status(201).json({ success: true, data: round });
    } catch (err) {
        if (err.code === 11000) {
            return res.status(400).json({ success: false, message: 'Round number already exists for this event' });
        }
        res.status(500).json({ success: false, message: err.message });
    }
});

// @desc    Add participants to a round (Shortlist)
// @route   POST /api/admin/rounds/:id/participants
router.post('/:id/participants', async (req, res) => {
    try {
        const { participantIds } = req.body;
        const round = await Round.findById(req.params.id);

        if (!round) {
            return res.status(404).json({ success: false, message: 'Round not found' });
        }

        // Add participants (avoid duplicates)
        participantIds.forEach(id => {
            if (!round.participants.includes(id)) {
                round.participants.push(id);
            }
        });

        await round.save();
        res.json({ success: true, data: round });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// @desc    Update round status/details
// @route   PUT /api/admin/rounds/:id
router.put('/:id', async (req, res) => {
    try {
        const round = await Round.findByIdAndUpdate(req.params.id, req.body, {
            new: true,
            runValidators: true
        });

        if (!round) {
            return res.status(404).json({ success: false, message: 'Round not found' });
        }

        res.json({ success: true, data: round });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// @desc    Start a round
// @route   POST /api/admin/rounds/:id/start
router.post('/:id/start', async (req, res) => {
    try {
        const round = await Round.findById(req.params.id).populate('participants');
        if (!round) return res.status(404).json({ success: false, message: 'Round not found' });

        round.status = 'active';
        round.startTime = new Date();
        await round.save();

        // Update participants status to 'busy' and update their specific sub-event status to 'active'
        await Participant.updateMany(
            { _id: { $in: round.participants } },
            {
                $set: {
                    currentStatus: 'busy',
                    currentEvent: round.subEvent,
                    [`statusPerSubEvent.${round.subEvent}.status`]: 'active',
                    [`statusPerSubEvent.${round.subEvent}.currentRound`]: round._id,
                    [`statusPerSubEvent.${round.subEvent}.roundNumber`]: round.roundNumber
                }
            }
        );

        // Emit live update
        const io = req.app.get('io');
        io.emit('availability_update');
        io.to(`subevent:${round.subEvent}`).emit('round:started', {
            roundId: round._id,
            name: round.name,
            subEventId: round.subEvent
        });

        // Notify each participant directly as well
        round.participants.forEach(p => {
            const participantId = p._id || p;
            io.to(`participant:${participantId}`).emit('participant:status_updated', {
                message: `The round "${round.name}" has started!`,
                status: 'busy'
            });
            io.to(`participant:${participantId}`).emit('participant:notification', {
                id: Date.now().toString(),
                type: 'round_started',
                title: 'Round Started!',
                message: `The round "${round.name}" has officially begun. Check your dashboard for venue details.`,
                timestamp: new Date()
            });
        });

        res.json({ success: true, data: round });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// @desc    End a round
// @route   POST /api/admin/rounds/:id/end
router.post('/:id/end', async (req, res) => {
    try {
        const round = await Round.findById(req.params.id);
        if (!round) return res.status(404).json({ success: false, message: 'Round not found' });

        round.status = 'completed';
        round.endTime = new Date();
        await round.save();

        // Update participants status back (only if they were busy/active, don't overwrite results)
        await Participant.updateMany(
            {
                _id: { $in: round.participants },
                currentStatus: { $nin: ['qualified', 'rejected'] }
            },
            { $set: { currentStatus: 'available', currentEvent: null } }
        );

        // Emit live update
        const io = req.app.get('io');
        io.emit('availability_update');
        io.to(`subevent:${round.subEvent}`).emit('round:ended', {
            roundId: round._id,
            name: round.name,
            subEventId: round.subEvent
        });

        // Notify each participant directly
        round.participants.forEach(p_id => {
            io.to(`participant:${p_id}`).emit('participant:status_updated', {
                message: `The round "${round.name}" has ended.`,
                status: 'available'
            });
            io.to(`participant:${p_id}`).emit('participant:notification', {
                id: Date.now().toString(),
                type: 'round_ended',
                title: 'Round Concluded',
                message: `The round "${round.name}" has finished. Results will be announced soon.`,
                timestamp: new Date()
            });
        });

        res.json({ success: true, data: round });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// @desc    Set winners/qualified for next round
// @route   POST /api/admin/rounds/:id/winners
router.post('/:id/winners', async (req, res) => {
    try {
        const { winnerIds } = req.body;
        const round = await Round.findById(req.params.id);

        if (!round) {
            return res.status(404).json({ success: false, message: 'Round not found' });
        }

        round.winners = winnerIds;
        await round.save();

        res.json({ success: true, data: round });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// @desc    Promote students selected by judges to next round
// @route   POST /api/admin/rounds/:id/promote-selected
router.post('/:id/promote-selected', async (req, res) => {
    try {
        const currentRound = await Round.findById(req.params.id);
        if (!currentRound) return res.status(404).json({ success: false, message: 'Round not found' });

        const Evaluation = require('../../models/Evaluation');
        const evaluations = await Evaluation.find({ roundId: currentRound._id });

        // Get all unique participant IDs who were selected for next round by AT LEAST ONE judge
        const selectedParticipantIds = new Set();
        evaluations.forEach(ev => {
            (ev.participantRatings || []).forEach(pr => {
                if (pr.selectedForNextRound) {
                    selectedParticipantIds.add(pr.participantId.toString());
                }
            });
        });

        const nextRoundNumber = currentRound.roundNumber + 1;
        const nextRound = await Round.findOne({
            subEvent: currentRound.subEvent,
            roundNumber: nextRoundNumber
        });

        if (!nextRound) {
            return res.status(400).json({
                success: false,
                message: `Next round (Round ${nextRoundNumber}) not found. Please create it first.`
            });
        }

        const participantIdsArray = Array.from(selectedParticipantIds);

        // Update next round's participants (avoid duplicates)
        participantIdsArray.forEach(id => {
            const exists = nextRound.participants.some(p => p.toString() === id.toString());
            if (!exists) {
                nextRound.participants.push(id);
            }
        });

        // Also update current round's winners and participants' status
        currentRound.winners = participantIdsArray;

        await Participant.updateMany(
            { _id: { $in: participantIdsArray } },
            {
                $set: {
                    currentStatus: 'qualified',
                    [`statusPerSubEvent.${currentRound.subEvent}.status`]: 'qualified'
                }
            }
        );

        // Mark others as eliminated for this sub-event
        await Participant.updateMany(
            {
                _id: { $in: currentRound.participants, $nin: participantIdsArray }
            },
            {
                $set: {
                    [`statusPerSubEvent.${currentRound.subEvent}.status`]: 'eliminated'
                }
            }
        );

        await Promise.all([nextRound.save(), currentRound.save()]);

        // Notify participants
        const io = req.app.get('io');
        if (io) {
            participantIdsArray.forEach(id => {
                io.to(`participant:${id}`).emit('participant:status_updated', {
                    message: `Congratulations! You have qualified for Round ${nextRoundNumber}!`,
                    status: 'qualified'
                });
                io.to(`participant:${id}`).emit('participant:notification', {
                    id: Date.now().toString(),
                    type: 'promotion',
                    title: 'Qualified for Next Round!',
                    message: `Great job! You have been promoted to ${nextRound.name}. Check your dashboard for the new schedule.`,
                    timestamp: new Date()
                });
            });
            io.emit('availability_update');
        }

        console.log(`✅ Promoted ${participantIdsArray.length} participants to Round ${nextRoundNumber}`);

        res.json({
            success: true,
            message: `Promoted ${participantIdsArray.length} students to Round ${nextRoundNumber}`,
            data: nextRound
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// @desc    Delete a round and all related data
// @route   DELETE /api/admin/rounds/:id
router.delete('/:id', async (req, res) => {
    try {
        const round = await Round.findById(req.params.id);
        if (!round) {
            return res.status(404).json({ success: false, message: 'Round not found' });
        }

        const Group = require('../../models/Group');
        const Evaluation = require('../../models/Evaluation');
        const Panel = require('../../models/Panel');

        // Delete related entities
        await Promise.all([
            Group.deleteMany({ roundId: round._id }),
            Evaluation.deleteMany({ roundId: round._id }),
            Panel.deleteMany({ roundId: round._id })
        ]);

        // If round was active, ensure participants are set back to available
        if (round.status === 'active') {
            await Participant.updateMany(
                {
                    _id: { $in: round.participants },
                    currentEvent: round.subEvent
                },
                { $set: { currentStatus: 'available', currentEvent: null } }
            );
        }

        // Delete the round itself
        await round.deleteOne();

        res.json({ success: true, message: 'Round and all related data deleted' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

module.exports = router;
