const express = require('express');
const router = express.Router();
const User = require('../../models/User');
const { protect, authorize } = require('../../middleware/auth');

// All routes are protected and require admin role
router.use(protect);
router.use(authorize('admin'));

// @route   GET /api/admin/users/pending
// @desc    Get all pending admin/judge requests
// @access  Private (Admin)
router.get('/pending', async (req, res, next) => {
    try {
        const pendingUsers = await User.find({ isApproved: false, role: 'admin' }).select('-password');
        res.status(200).json({
            success: true,
            data: pendingUsers
        });
    } catch (error) {
        next(error);
    }
});

// @route   PUT /api/admin/users/:id/approve
// @desc    Approve an admin/judge request
// @access  Private (Admin)
router.put('/:id/approve', async (req, res, next) => {
    try {
        const user = await User.findById(req.params.id);

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        user.isApproved = true;
        user.isActive = true;
        await user.save();

        // Notify user via some means? Or just let them try logging in again.
        // We could emit a socket event if the user is connected, but usually they are logged out.

        res.status(200).json({
            success: true,
            message: `${user.role} approved successfully`,
            data: user
        });
    } catch (error) {
        next(error);
    }
});

// @route   DELETE /api/admin/users/:id
// @desc    Reject/Delete an admin/judge request
// @access  Private (Admin)
router.delete('/:id', async (req, res, next) => {
    try {
        const user = await User.findById(req.params.id);

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        if (user._id.toString() === req.user.id.toString()) {
            return res.status(400).json({
                success: false,
                message: 'You cannot reject yourself'
            });
        }

        await user.deleteOne();

        res.status(200).json({
            success: true,
            message: 'User request rejected and deleted'
        });
    } catch (error) {
        next(error);
    }
});

// @route   GET /api/admin/users
// @desc    Get all admins and judges
// @access  Private (Admin)
router.get('/', async (req, res, next) => {
    try {
        const users = await User.find({}).select('-password');
        res.status(200).json({
            success: true,
            data: users
        });
    } catch (error) {
        next(error);
    }
});

module.exports = router;
