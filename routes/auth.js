const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Participant = require('../models/Participant');
const { protect } = require('../middleware/auth');
const { admin } = require('../config/firebase');
const jwt = require('jsonwebtoken'); // Need this for generating tokens if model doesn't handle all roles easily

// @route   POST /api/auth/register
// @desc    Register a new user (admin/judge)
// @access  Public (in production, this should be protected or invite-only)
router.post('/register', async (req, res, next) => {
    try {
        const { name, email, password, role } = req.body;

        // Validation
        if (!name || !email || !password) {
            return res.status(400).json({
                success: false,
                message: 'Please provide name, email, and password'
            });
        }

        // Check if user already exists
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({
                success: false,
                message: 'User already exists with this email'
            });
        }

        // Check if any admin exists. First admin should be auto-approved.
        const adminCount = await User.countDocuments({ role: 'admin' });
        const autoApprove = (role === 'admin' || !role) && adminCount === 0;

        // Create user
        const user = await User.create({
            name,
            email,
            password,
            role: role || 'judge',
            isApproved: autoApprove || (role === 'judge') // Judges auto-approved? Or maybe not. Let's assume admins only for now.
        });

        if (user.role === 'admin' && !user.isApproved) {
            // Notify existing admins
            const io = req.app.get('io');
            if (io) {
                io.to('admin').emit('admin:request', {
                    id: user._id,
                    name: user.name,
                    email: user.email
                });
            }
        }

        // Generate token
        const token = user.getSignedJwtToken();

        res.status(201).json({
            success: true,
            message: 'User registered successfully',
            data: {
                user: {
                    id: user._id,
                    name: user.name,
                    email: user.email,
                    role: user.role
                },
                token
            }
        });
    } catch (error) {
        next(error);
    }
});

router.post('/login', async (req, res, next) => {
    try {
        const { email, password, role } = req.body;

        // Validation
        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: 'Please provide email and password'
            });
        }

        let user;
        if (role === 'participant') {
            // Check for participant
            user = await Participant.findOne({ email }).select('+password');
            if (!user) {
                return res.status(401).json({
                    success: false,
                    message: 'Invalid credentials'
                });
            }
        } else {
            // Check for user (admin/judge)
            user = await User.findOne({ email }).select('+password');
            if (!user) {
                return res.status(401).json({
                    success: false,
                    message: 'Invalid credentials'
                });
            }

            // Check if user is active
            if (!user.isActive) {
                return res.status(401).json({
                    success: false,
                    message: 'Your account has been deactivated'
                });
            }

            // Check if admin is approved
            if (user.role === 'admin' && !user.isApproved) {
                return res.status(401).json({
                    success: false,
                    message: 'Your admin account is pending approval by another administrator.'
                });
            }
        }

        // Check if password matches
        const isMatch = await user.matchPassword(password);
        if (!isMatch) {
            return res.status(401).json({
                success: false,
                message: 'Invalid credentials'
            });
        }

        // Generate token
        const token = user.getSignedJwtToken();

        res.status(200).json({
            success: true,
            message: 'Login successful',
            data: {
                user: {
                    id: user._id,
                    name: user.fullName || user.name,
                    email: user.email,
                    role: role || user.role,
                    profileComplete: user.profileComplete !== undefined ? user.profileComplete : !!user.mobile,
                    registrationStatus: user.registrationStatus
                },
                token
            }
        });
    } catch (error) {
        next(error);
    }
});

// @route   POST /api/auth/google-login
// @desc    Login/Register with Google
// @access  Public
router.post('/google-login', async (req, res, next) => {
    try {
        const { firebaseToken, role } = req.body;

        if (!firebaseToken) {
            return res.status(400).json({ success: false, message: 'No token provided' });
        }

        // Verify Firebase Token
        let decodedToken;
        try {
            decodedToken = await admin.auth().verifyIdToken(firebaseToken);
        } catch (err) {
            console.error('Firebase token verification failed:', err.message);
            return res.status(401).json({ success: false, message: 'Invalid Firebase token' });
        }

        const { email, name, picture, uid } = decodedToken;

        let userResponse = null;
        let token = null;

        let isNewUser = false;

        if (role === 'admin') {
            // Check in User model
            let user = await User.findOne({ email });
            if (!user) {
                isNewUser = true;
                // Auto-register if not found
                user = await User.create({
                    name: name || 'Google Admin',
                    email,
                    password: Math.random().toString(36).slice(-8), // Random pw for schema req
                    role: 'admin',
                    profileComplete: false,
                    isApproved: false // Default to false for social login too
                });

                // Check if this is the first admin
                const adminCount = await User.countDocuments({ role: 'admin' });
                if (adminCount === 1) { // It's this user
                    user.isApproved = true;
                    await user.save();
                } else {
                    // Notify existing admins
                    const io = req.app.get('io');
                    if (io) {
                        io.to('admin').emit('admin:request', {
                            id: user._id,
                            name: user.name,
                            email: user.email
                        });
                    }
                }
            }

            // Check if approved
            if (!user.isApproved) {
                return res.status(401).json({
                    success: false,
                    message: 'Your admin account is pending approval by another administrator.'
                });
            }
            token = user.getSignedJwtToken();
            userResponse = {
                id: user._id,
                name: user.name,
                email: user.email,
                role: user.role,
                profileComplete: user.profileComplete
            };
        } else {
            // Role is participant
            let participant = await Participant.findOne({ email });
            if (!participant) {
                isNewUser = true;
                // Auto-register if not found
                participant = await Participant.create({
                    fullName: name || 'Google Participant',
                    email,
                    registrationStatus: 'incomplete'
                });
            }

            // Generate token
            token = jwt.sign(
                { id: participant._id, role: 'participant' },
                process.env.JWT_SECRET,
                { expiresIn: process.env.JWT_EXPIRE }
            );

            userResponse = {
                id: participant._id,
                name: participant.fullName,
                email: participant.email,
                role: 'participant',
                status: participant.registrationStatus,
                profileComplete: participant.mobile ? true : false
            };
        }

        res.status(200).json({
            success: true,
            data: {
                user: userResponse,
                token,
                isNewUser
            }
        });

    } catch (error) {
        next(error);
    }
});

// @route   POST /api/auth/google-signup
// @desc    Initial Google signup for users/participants
router.post('/google-signup', async (req, res, next) => {
    try {
        const { firebaseToken, role } = req.body;
        const decodedToken = await admin.auth().verifyIdToken(firebaseToken);
        const { email, name, uid } = decodedToken;

        // Check if user already exists
        if (role === 'admin') {
            const user = await User.findOne({ email });
            if (user) {
                return res.status(400).json({ success: false, message: 'User already exists, please login instead' });
            }
        } else {
            const participant = await Participant.findOne({ email });
            if (participant) {
                return res.status(400).json({ success: false, message: 'Participant already exists, please login instead' });
            }
        }

        res.status(200).json({
            success: true,
            data: {
                user: { email, name, role }
            }
        });
    } catch (error) {
        next(error);
    }
});

// @route   GET /api/auth/me
// @desc    Get current logged in user
// @access  Private
router.get('/me', protect, async (req, res, next) => {
    try {
        const user = await User.findById(req.user.id);

        res.status(200).json({
            success: true,
            data: {
                user: {
                    id: user._id,
                    name: user.name,
                    email: user.email,
                    role: user.role,
                    isActive: user.isActive
                }
            }
        });
    } catch (error) {
        next(error);
    }
});

// @route   PUT /api/auth/complete-profile
// @desc    Complete user profile after Google signup
// @access  Private
router.put('/complete-profile', protect, async (req, res, next) => {
    try {
        const { name, phone, organization, department, role } = req.body;

        if (role === 'admin') {
            // Update admin user profile
            const user = await User.findById(req.user.id);

            if (!user) {
                return res.status(404).json({
                    success: false,
                    message: 'User not found'
                });
            }

            // Update fields
            if (name) user.name = name;
            if (phone) user.phone = phone;
            if (organization) user.organization = organization;
            if (department) user.department = department;
            user.profileComplete = true;

            await user.save();

            // Generate new token with updated info
            const token = user.getSignedJwtToken();

            res.status(200).json({
                success: true,
                message: 'Profile completed successfully',
                data: {
                    user: {
                        id: user._id,
                        name: user.name,
                        email: user.email,
                        role: user.role,
                        phone: user.phone,
                        organization: user.organization,
                        department: user.department,
                        profileComplete: user.profileComplete
                    },
                    token
                }
            });
        } else if (role === 'participant') {
            const participant = await Participant.findById(req.user.id);
            if (!participant) {
                return res.status(404).json({ success: false, message: 'Participant not found' });
            }

            const { fullName, mobile, phone, college } = req.body;
            if (fullName) participant.fullName = fullName;
            if (mobile || phone) participant.mobile = mobile || phone;
            if (college) participant.college = college;

            await participant.save();

            // Generate token
            const token = jwt.sign(
                { id: participant._id, role: 'participant' },
                process.env.JWT_SECRET,
                { expiresIn: process.env.JWT_EXPIRE }
            );

            res.status(200).json({
                success: true,
                message: 'Participant profile completed',
                data: {
                    user: {
                        id: participant._id,
                        name: participant.fullName,
                        email: participant.email,
                        role: 'participant',
                        mobile: participant.mobile,
                        college: participant.college,
                        profileComplete: true
                    },
                    token
                }
            });
        } else {
            // For participants, just acknowledge (they complete profile during event registration)
            res.status(200).json({
                success: true,
                message: 'Profile noted',
                data: {
                    user: req.user
                }
            });
        }
    } catch (error) {
        next(error);
    }
});

module.exports = router;
