const express = require('express');
const router = express.Router();
const Query = require('../models/Query');

// @route   POST /api/queries
// @desc    Submit a new query
// @access  Public
router.post('/', async (req, res, next) => {
    try {
        const { fullName, email, mobile, subject, message } = req.body;

        // Validate required fields
        if (!fullName || !email || !mobile || !subject || !message) {
            return res.status(400).json({
                success: false,
                message: 'Please provide all required fields'
            });
        }

        // Validate mobile number
        const mobileRegex = /^[6-9][0-9]{9}$/;
        if (!mobileRegex.test(mobile)) {
            return res.status(400).json({
                success: false,
                message: 'Please provide a valid 10-digit Indian mobile number'
            });
        }

        // Create query
        const query = await Query.create({
            fullName,
            email,
            mobile,
            subject,
            message
        });

        res.status(201).json({
            success: true,
            message: 'Query submitted successfully. We will get back to you soon!',
            data: {
                id: query._id,
                createdAt: query.createdAt
            }
        });
    } catch (error) {
        next(error);
    }
});

module.exports = router;
