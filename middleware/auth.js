const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Participant = require('../models/Participant');

// Protect routes - verify JWT token
exports.protect = async (req, res, next) => {
    let token;

    // Check for token in Authorization header
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        token = req.headers.authorization.split(' ')[1];
    }

    // Make sure token exists
    if (!token) {
        return res.status(401).json({
            success: false,
            message: 'Not authorized - No token'
        });
    }

    try {
        // Verify token
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // Get user from token based on role
        if (decoded.role === 'admin' || decoded.role === 'judge') {
            req.user = await User.findById(decoded.id).select('-password');
        } else if (decoded.role === 'participant') {
            req.user = await Participant.findById(decoded.id);
            // Patch req.user to have role if needed for other middleware
            if (req.user) req.user.role = 'participant';
        }

        if (!req.user) {
            return res.status(401).json({
                success: false,
                message: 'User session expired or user not found'
            });
        }

        // Check if admin is approved
        if ((decoded.role === 'admin' || req.user.role === 'admin') && !req.user.isApproved) {
            return res.status(401).json({
                success: false,
                message: 'Your admin account is pending approval by another administrator.'
            });
        }

        next();
    } catch (error) {
        return res.status(401).json({
            success: false,
            message: 'Not authorized - Token invalid'
        });
    }
};

// Grant access to specific roles
exports.authorize = (...roles) => {
    return (req, res, next) => {
        if (!roles.includes(req.user.role)) {
            return res.status(403).json({
                success: false,
                message: `User role '${req.user.role}' is not authorized to access this route`
            });
        }
        next();
    };
};
