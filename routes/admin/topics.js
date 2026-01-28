const express = require('express');
const router = express.Router();
const Topic = require('../../models/Topic');
const SubEvent = require('../../models/SubEvent');
const { protect, authorize } = require('../../middleware/auth');

router.use(protect);
router.use(authorize('admin'));

// @desc    Get all topics (optionally filter by subEvent)
// @route   GET /api/admin/topics
router.get('/', async (req, res, next) => {
    try {
        const { subEventId } = req.query;
        let query = {};
        if (subEventId) query.subEventId = subEventId;

        const topics = await Topic.find(query)
            .populate('subEventId', 'name')
            .populate('usedByGroup', 'groupName')
            .sort({ createdAt: -1 });

        res.status(200).json({
            success: true,
            data: topics
        });
    } catch (error) {
        next(error);
    }
});

// @desc    Add multiple topics to a subevent
// @route   POST /api/admin/topics
router.post('/', async (req, res, next) => {
    try {
        const { subEventId, topics } = req.body;

        if (!subEventId || !topics || !Array.isArray(topics)) {
            return res.status(400).json({
                success: false,
                message: 'Please provide subEventId and an array of topics'
            });
        }

        const topicDocs = topics.map(content => ({
            content,
            subEventId
        }));

        const createdTopics = await Topic.insertMany(topicDocs);

        res.status(201).json({
            success: true,
            data: createdTopics
        });
    } catch (error) {
        next(error);
    }
});

// @desc    Update a topic
// @route   PUT /api/admin/topics/:id
router.put('/:id', async (req, res, next) => {
    try {
        const topic = await Topic.findByIdAndUpdate(req.params.id, req.body, {
            new: true,
            runValidators: true
        });

        if (!topic) {
            return res.status(404).json({
                success: false,
                message: 'Topic not found'
            });
        }

        res.status(200).json({
            success: true,
            data: topic
        });
    } catch (error) {
        next(error);
    }
});

// @desc    Delete a topic
// @route   DELETE /api/admin/topics/:id
router.delete('/:id', async (req, res, next) => {
    try {
        const topic = await Topic.findById(req.params.id);

        if (!topic) {
            return res.status(404).json({
                success: false,
                message: 'Topic not found'
            });
        }

        await topic.deleteOne();

        res.status(200).json({
            success: true,
            message: 'Topic deleted'
        });
    } catch (error) {
        next(error);
    }
});

// @desc    Delete multiple topics
// @route   POST /api/admin/topics/bulk-delete
router.post('/bulk-delete', async (req, res, next) => {
    try {
        const { topicIds } = req.body;
        await Topic.deleteMany({ _id: { $in: topicIds } });

        res.status(200).json({
            success: true,
            message: 'Topics deleted'
        });
    } catch (error) {
        next(error);
    }
});

module.exports = router;
