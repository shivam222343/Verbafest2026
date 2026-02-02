const express = require('express');
const router = express.Router();
const Query = require('../../models/Query');
const { protect, authorize } = require('../../middleware/auth');

// All routes are protected and require admin role
router.use(protect);
router.use(authorize('admin'));

// @route   GET /api/admin/queries
// @desc    Get all queries
// @access  Private (Admin)
router.get('/', async (req, res, next) => {
    try {
        const { status, page = 1, limit = 1000 } = req.query;

        const filter = {};
        if (status) {
            filter.status = status;
        }

        const queries = await Query.find(filter)
            .sort({ createdAt: -1 })
            .limit(limit * 1)
            .skip((page - 1) * limit);

        const total = await Query.countDocuments(filter);

        res.status(200).json({
            success: true,
            count: queries.length,
            total,
            totalPages: Math.ceil(total / limit),
            currentPage: page,
            data: queries
        });
    } catch (error) {
        next(error);
    }
});

// @route   GET /api/admin/queries/:id
// @desc    Get single query
// @access  Private (Admin)
router.get('/:id', async (req, res, next) => {
    try {
        const query = await Query.findById(req.params.id)
            .populate('resolvedBy', 'fullName email');

        if (!query) {
            return res.status(404).json({
                success: false,
                message: 'Query not found'
            });
        }

        res.status(200).json({
            success: true,
            data: query
        });
    } catch (error) {
        next(error);
    }
});

// @route   PUT /api/admin/queries/:id/status
// @desc    Update query status
// @access  Private (Admin)
router.put('/:id/status', async (req, res, next) => {
    try {
        const { status, adminNotes } = req.body;

        const query = await Query.findById(req.params.id);

        if (!query) {
            return res.status(404).json({
                success: false,
                message: 'Query not found'
            });
        }

        if (status) {
            query.status = status;
            if (status === 'resolved') {
                query.resolvedAt = new Date();
                query.resolvedBy = req.user._id;
            }
        }

        if (adminNotes !== undefined) {
            query.adminNotes = adminNotes;
        }

        await query.save();

        res.status(200).json({
            success: true,
            message: 'Query updated successfully',
            data: query
        });
    } catch (error) {
        next(error);
    }
});

// @route   DELETE /api/admin/queries/:id
// @desc    Delete query
// @access  Private (Admin)
router.delete('/:id', async (req, res, next) => {
    try {
        const query = await Query.findById(req.params.id);

        if (!query) {
            return res.status(404).json({
                success: false,
                message: 'Query not found'
            });
        }

        await query.deleteOne();

        res.status(200).json({
            success: true,
            message: 'Query deleted successfully'
        });
    } catch (error) {
        next(error);
    }
});

// @route   GET /api/admin/queries/stats/summary
// @desc    Get query statistics
// @access  Private (Admin)
router.get('/stats/summary', async (req, res, next) => {
    try {
        const [pending, inProgress, resolved, total] = await Promise.all([
            Query.countDocuments({ status: 'pending' }),
            Query.countDocuments({ status: 'in_progress' }),
            Query.countDocuments({ status: 'resolved' }),
            Query.countDocuments()
        ]);

        res.status(200).json({
            success: true,
            data: {
                pending,
                inProgress,
                resolved,
                total
            }
        });
    } catch (error) {
        next(error);
    }
});

module.exports = router;
