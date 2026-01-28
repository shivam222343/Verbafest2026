const express = require('express');
const router = express.Router();
const Panel = require('../../models/Panel');
const Group = require('../../models/Group');
const SubEvent = require('../../models/SubEvent');
const Round = require('../../models/Round');
const { protect, authorize } = require('../../middleware/auth');

// All routes are protected and require admin role
router.use(protect);
router.use(authorize('admin'));

// @route   POST /api/admin/panels
// @desc    Create a new panel
// @access  Private (Admin)
router.post('/', async (req, res, next) => {
    try {
        const {
            subEventId,
            roundId,
            panelName,
            judges,
            evaluationParameters,
            venue,
            instructions
        } = req.body;

        if (!subEventId || !panelName || !judges || judges.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Please provide all required fields'
            });
        }

        // Get panel count for this subevent
        const panelCount = await Panel.countDocuments({ subEventId });

        // Generate access codes for judges
        const judgesWithCodes = judges.map(judge => ({
            ...judge,
            accessCode: Math.random().toString(36).substring(2, 10).toUpperCase(),
            hasAccessed: false
        }));

        const panel = await Panel.create({
            subEventId,
            roundId,
            panelNumber: panelCount + 1,
            panelName,
            judges: judgesWithCodes,
            evaluationParameters: evaluationParameters || [
                { name: 'Content', maxScore: 10, weight: 1 },
                { name: 'Presentation', maxScore: 10, weight: 1 },
                { name: 'Teamwork', maxScore: 10, weight: 1 }
            ],
            venue,
            instructions
        });

        // Emit socket event to all admins
        const io = req.app.get('io');
        io.to('admin').emit('panel:created', {
            panelId: panel._id,
            panelName: panel.panelName,
            roundId: panel.roundId,
            judgeCount: panel.judges.length
        });

        res.status(201).json({
            success: true,
            message: 'Panel created successfully',
            data: panel
        });
    } catch (error) {
        next(error);
    }
});

// @route   GET /api/admin/panels/round/:roundId
// @desc    Get all panels for a round
// @access  Private (Admin)
router.get('/round/:roundId', async (req, res, next) => {
    try {
        const panels = await Panel.find({ roundId: req.params.roundId })
            .populate('assignedGroups')
            .sort({ panelNumber: 1 });

        res.status(200).json({
            success: true,
            count: panels.length,
            data: panels
        });
    } catch (error) {
        next(error);
    }
});

// @route   GET /api/admin/panels/subevent/:subEventId
// @desc    Get all panels for a subevent (across all rounds)
// @access  Private (Admin)
router.get('/subevent/:subEventId', async (req, res, next) => {
    try {
        const panels = await Panel.find({ subEventId: req.params.subEventId })
            .populate('assignedGroups')
            .sort({ panelNumber: 1 });

        res.status(200).json({
            success: true,
            count: panels.length,
            data: panels
        });
    } catch (error) {
        next(error);
    }
});

// @route   GET /api/admin/panels/:id
// @desc    Get single panel with details
// @access  Private (Admin)
router.get('/:id', async (req, res, next) => {
    console.log(`🔍 Fetching single panel details for ID: ${req.params.id}`);
    try {
        const panel = await Panel.findById(req.params.id)
            .populate({
                path: 'assignedGroups',
                populate: {
                    path: 'participants',
                    select: 'fullName email prn branch year'
                }
            });

        if (!panel) {
            return res.status(404).json({
                success: false,
                message: 'Panel not found'
            });
        }

        res.status(200).json({
            success: true,
            data: panel
        });
    } catch (error) {
        next(error);
    }
});

// @route   PUT /api/admin/panels/:id
// @desc    Update panel
// @access  Private (Admin)
router.put('/:id', async (req, res, next) => {
    try {
        const panel = await Panel.findById(req.params.id);
        if (!panel) {
            return res.status(404).json({
                success: false,
                message: 'Panel not found'
            });
        }

        const {
            panelName,
            judges,
            evaluationParameters,
            venue,
            instructions,
            status
        } = req.body;

        if (panelName) panel.panelName = panelName;
        if (judges) panel.judges = judges;
        if (evaluationParameters) panel.evaluationParameters = evaluationParameters;
        if (venue) panel.venue = venue;
        if (instructions) panel.instructions = instructions;
        if (status) panel.status = status;

        await panel.save();

        res.status(200).json({
            success: true,
            message: 'Panel updated successfully',
            data: panel
        });
    } catch (error) {
        next(error);
    }
});

// @route   DELETE /api/admin/panels/:id
// @desc    Delete panel
// @access  Private (Admin)
router.delete('/:id', async (req, res, next) => {
    try {
        const panel = await Panel.findById(req.params.id);
        if (!panel) {
            return res.status(404).json({
                success: false,
                message: 'Panel not found'
            });
        }

        // Unassign groups
        await Group.updateMany(
            { panelId: panel._id },
            { panelId: null }
        );

        await panel.deleteOne();

        res.status(200).json({
            success: true,
            message: 'Panel deleted successfully'
        });
    } catch (error) {
        next(error);
    }
});

// @route   POST /api/admin/panels/:id/assign-groups
// @desc    Assign multiple groups to a panel
// @access  Private (Admin)
router.post('/:id/assign-groups', async (req, res, next) => {
    try {
        const { groupIds } = req.body;

        if (!groupIds || !Array.isArray(groupIds)) {
            return res.status(400).json({
                success: false,
                message: 'Please provide groupIds array'
            });
        }

        const panel = await Panel.findById(req.params.id);
        if (!panel) {
            return res.status(404).json({
                success: false,
                message: 'Panel not found'
            });
        }

        // Update groups
        // 1. Unassign all groups currently assigned to this panel FOR THIS ROUND (if we knew the round)
        // Since we don't pass roundId here directly, let's find the roundId from one of the groups
        let detectedRoundId = null;
        if (groupIds.length > 0) {
            const sampleGroup = await Group.findById(groupIds[0]);
            detectedRoundId = sampleGroup?.roundId;
        }

        if (detectedRoundId) {
            // Unassign all groups previously assigned to this panel in this round
            await Group.updateMany(
                { panelId: panel._id, roundId: detectedRoundId },
                { panelId: null }
            );
        }

        // 2. Assign new groups
        await Group.updateMany(
            { _id: { $in: groupIds } },
            { panelId: panel._id }
        );

        // 3. Update panel's assignedGroups cache (merging with other rounds)
        // Find all groups assigned to this panel across all rounds
        const allAssignedGroups = await Group.find({ panelId: panel._id }).select('_id');
        panel.assignedGroups = allAssignedGroups.map(g => g._id);

        await panel.save();

        // Emit socket event to the panel room (Judges listen here)
        const io = req.app.get('io');
        io.to(`panel:${panel._id}`).emit('group:assigned', {
            panelId: panel._id,
            groupIds: groupIds
        });

        res.status(200).json({
            success: true,
            message: `Assigned ${groupIds.length} groups to panel`,
            data: panel
        });
    } catch (error) {
        next(error);
    }
});

// @route   POST /api/admin/panels/:id/regenerate-codes
// @desc    Regenerate access codes for judges
// @access  Private (Admin)
router.post('/:id/regenerate-codes', async (req, res, next) => {
    try {
        const panel = await Panel.findById(req.params.id);
        if (!panel) {
            return res.status(404).json({
                success: false,
                message: 'Panel not found'
            });
        }

        panel.judges = panel.judges.map(judge => ({
            ...judge.toObject(),
            accessCode: Math.random().toString(36).substring(2, 10).toUpperCase(),
            hasAccessed: false
        }));

        await panel.save();

        res.status(200).json({
            success: true,
            message: 'Access codes regenerated successfully',
            data: panel
        });
    } catch (error) {
        next(error);
    }
});

// @route   GET /api/admin/panels/round/:roundId/evaluations
// @desc    Get all evaluations for all groups/panels in a round
// @access  Private (Admin)
router.get('/round/:roundId/evaluations', async (req, res, next) => {
    try {
        const evaluations = await require('../../models/Evaluation').find({ roundId: req.params.roundId })
            .select('-__v');

        res.status(200).json({
            success: true,
            count: evaluations.length,
            data: evaluations
        });
    } catch (error) {
        next(error);
    }
});

module.exports = router;
