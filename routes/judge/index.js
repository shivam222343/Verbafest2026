const express = require('express');
const router = express.Router();
const Panel = require('../../models/Panel');
const Group = require('../../models/Group');
const Evaluation = require('../../models/Evaluation');
const Participant = require('../../models/Participant');

// @route   POST /api/judge/login
// @desc    Judge login with access code
// @access  Public
router.post('/login', async (req, res, next) => {
    try {
        const { accessCode } = req.body;

        if (!accessCode) {
            return res.status(400).json({
                success: false,
                message: 'Please provide access code'
            });
        }

        const cleanedCode = accessCode.trim().toUpperCase();
        const panel = await Panel.findOne({ 'judges.accessCode': cleanedCode });

        if (!panel) {
            return res.status(401).json({
                success: false,
                message: 'Invalid access code'
            });
        }

        // Find the specific judge
        const judge = panel.judges.find(j => j.accessCode === cleanedCode);

        if (!judge) {
            return res.status(401).json({
                success: false,
                message: 'Invalid access code'
            });
        }

        // Update judge access status
        judge.hasAccessed = true;
        judge.lastAccessedAt = new Date();
        await panel.save();

        // Emit socket event to admin room
        const io = req.app.get('io');
        io.to('admin').emit('judge:logged_in', {
            panelId: panel._id,
            panelName: panel.panelName,
            judgeName: judge.name,
            judgeEmail: judge.email,
            accessedAt: judge.lastAccessedAt
        });

        res.status(200).json({
            success: true,
            message: 'Login successful',
            data: {
                panelId: panel._id,
                judgeName: judge.name,
                judgeEmail: judge.email,
                panelName: panel.panelName,
                accessCode: judge.accessCode
            }
        });
    } catch (error) {
        next(error);
    }
});

// @route   GET /api/judge/panel/:accessCode
// @desc    Get panel details and assigned groups
// @access  Public (with access code)
router.get('/panel/:accessCode', async (req, res, next) => {
    try {
        const cleanedCode = req.params.accessCode.trim().toUpperCase();
        const panel = await Panel.findOne({ 'judges.accessCode': cleanedCode })
            .populate({
                path: 'assignedGroups',
                populate: {
                    path: 'participants',
                    select: 'fullName email prn branch year college'
                }
            })
            .populate('subEventId', 'name type')
            .populate('roundId', 'name roundNumber');

        if (!panel) {
            return res.status(404).json({
                success: false,
                message: 'Panel not found'
            });
        }

        const judge = panel.judges.find(j => j.accessCode === cleanedCode);

        res.status(200).json({
            success: true,
            data: {
                panel: {
                    _id: panel._id,
                    panelName: panel.panelName,
                    panelNumber: panel.panelNumber,
                    venue: panel.venue,
                    instructions: panel.instructions,
                    evaluationParameters: panel.evaluationParameters,
                    subEvent: panel.subEventId,
                    round: panel.roundId
                },
                judge: {
                    name: judge.name,
                    email: judge.email
                },
                groups: panel.assignedGroups
            }
        });
    } catch (error) {
        next(error);
    }
});

// @route   POST /api/judge/evaluate
// @desc    Submit evaluation for a group
// @access  Public (with access code)
router.post('/evaluate', async (req, res, next) => {
    try {
        const {
            accessCode,
            groupId,
            scores,
            comments,
            recommendForNextRound,
            participantRatings,
            totalScore: pTotalScore,
            maxTotalScore: pMaxTotalScore
        } = req.body;

        // Debug logging
        console.log('Processing evaluation submission:', { accessCode, groupId });

        if (!accessCode || !groupId) {
            return res.status(400).json({
                success: false,
                message: 'Please provide access code and group ID'
            });
        }

        const panel = await Panel.findOne({ 'judges.accessCode': accessCode.toUpperCase() });
        if (!panel) {
            console.log('Panel not found for access code:', accessCode);
            return res.status(401).json({
                success: false,
                message: 'Invalid access code'
            });
        }

        const judge = panel.judges.find(j => j.accessCode === accessCode.toUpperCase());
        const group = await Group.findById(groupId);

        if (!group) {
            console.log('Group not found:', groupId);
            return res.status(404).json({
                success: false,
                message: 'Group not found'
            });
        }

        // Use participant-based scores if provided
        let finalTotalScore = pTotalScore;
        let finalMaxTotalScore = pMaxTotalScore;

        // Fallback for older interface/single scores
        if (!finalMaxTotalScore || finalMaxTotalScore === 0) {
            finalTotalScore = 0;
            finalMaxTotalScore = 0;
            if (scores && Array.isArray(scores)) {
                scores.forEach(score => {
                    finalTotalScore += parseFloat(score.score) * (score.weight || 1);
                    finalMaxTotalScore += parseFloat(score.maxScore) * (score.weight || 1);
                });
            }
        }

        console.log('Calculated Scores:', { finalTotalScore, finalMaxTotalScore });

        // Check if evaluation already exists
        let evaluation = await Evaluation.findOne({
            groupId,
            panelId: panel._id,
            judgeEmail: judge.email
        });

        if (evaluation) {
            // Update existing evaluation
            evaluation.scores = scores; // Keep for param breakdown
            evaluation.totalScore = finalTotalScore;
            evaluation.maxTotalScore = finalMaxTotalScore;
            evaluation.comments = comments || '';
            evaluation.recommendForNextRound = recommendForNextRound || false;
            evaluation.participantRatings = participantRatings || [];
            evaluation.submittedAt = new Date();
        } else {
            // Create new evaluation
            evaluation = new Evaluation({
                groupId,
                panelId: panel._id,
                roundId: group.roundId,
                judgeEmail: judge.email,
                judgeName: judge.name,
                scores,
                totalScore: finalTotalScore,
                maxTotalScore: finalMaxTotalScore,
                comments: comments || '',
                recommendForNextRound: recommendForNextRound || false,
                participantRatings: participantRatings || []
            });
        }

        await evaluation.save();
        console.log('Evaluation saved successfully:', evaluation._id);

        // Update group evaluation status - fetch fresh list including current evaluation
        const allEvaluations = await Evaluation.find({ groupId });
        if (allEvaluations.length >= panel.judges.length) {
            group.evaluationStatus = 'completed';

            // Calculate average score - handle potential missing percentage
            const totalPercentage = allEvaluations.reduce((sum, ev) => sum + (ev.percentage || 0), 0);
            group.averageScore = totalPercentage / allEvaluations.length;
        } else {
            group.evaluationStatus = 'in_progress';
        }

        await group.save();
        console.log('Group status updated:', group.evaluationStatus);

        // Emit socket event to admin room for real-time updates
        const io = req.app.get('io');
        io.to('admin').emit('evaluation:submitted', {
            evaluationId: evaluation._id,
            groupId: group._id,
            groupName: group.groupName,
            panelId: panel._id,
            panelName: panel.panelName,
            judgeName: judge.name,
            percentage: evaluation.percentage || 0,
            evaluationStatus: group.evaluationStatus,
            averageScore: group.averageScore || 0
        });

        // Emit to panel-specific room for judges to see progress
        io.to(`panel:${panel._id}`).emit('evaluation:updated', {
            groupId: group._id,
            evaluationStatus: group.evaluationStatus,
            evaluationCount: allEvaluations.length,
            totalJudges: panel.judges.length
        });

        res.status(201).json({
            success: true,
            message: 'Evaluation submitted successfully',
            data: evaluation
        });
    } catch (error) {
        console.error('Error in evaluation submission:', error);
        next(error);
    }
});

// @route   GET /api/judge/evaluations/:accessCode/:groupId
// @desc    Get judge's evaluation for a specific group
// @access  Public (with access code)
router.get('/evaluations/:accessCode/:groupId', async (req, res, next) => {
    try {
        const panel = await Panel.findOne({ 'judges.accessCode': req.params.accessCode.toUpperCase() });

        if (!panel) {
            return res.status(401).json({
                success: false,
                message: 'Invalid access code'
            });
        }

        const judge = panel.judges.find(j => j.accessCode === req.params.accessCode.toUpperCase());

        const evaluation = await Evaluation.findOne({
            groupId: req.params.groupId,
            panelId: panel._id,
            judgeEmail: judge.email
        });

        res.status(200).json({
            success: true,
            data: evaluation
        });
    } catch (error) {
        next(error);
    }
});

// @route   POST /api/judge/select-for-next-round
// @desc    Judge selects groups for next round
// @access  Public (with access code)
router.post('/select-for-next-round', async (req, res, next) => {
    try {
        const { accessCode, selectedGroupIds } = req.body;

        if (!accessCode || !selectedGroupIds || !Array.isArray(selectedGroupIds)) {
            return res.status(400).json({
                success: false,
                message: 'Please provide accessCode and selectedGroupIds array'
            });
        }

        const panel = await Panel.findOne({ 'judges.accessCode': accessCode.toUpperCase() });

        if (!panel) {
            return res.status(401).json({
                success: false,
                message: 'Invalid access code'
            });
        }

        // Mark groups as recommended by this judge
        await Group.updateMany(
            { _id: { $in: selectedGroupIds } },
            { selectedForNextRound: true }
        );

        res.status(200).json({
            success: true,
            message: `Selected ${selectedGroupIds.length} groups for next round`
        });
    } catch (error) {
        next(error);
    }
});

module.exports = router;
