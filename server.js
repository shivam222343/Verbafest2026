require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { createServer } = require('http');
const { Server } = require('socket.io');
const connectDB = require('./config/db');
const { testCloudinaryConnection } = require('./config/cloudinary');
const { initializeFirebase } = require('./config/firebase');
const errorHandler = require('./middleware/errorHandler');

// Initialize Firebase Admin
initializeFirebase();

// Initialize Express app
const app = express();
const httpServer = createServer(app);

// Initialize Socket.IO
const allowedOrigins = [
    'http://localhost:5173',
    'https://verbafest2026.netlify.app',
    'https://verbafest-2026.netlify.app',
    'https://verbafest2026.teammavericks.org',
    'https://www.verbafest2026.teammavericks.org',
    'https://verbafest2026-frontend-duz5.vercel.app',
    process.env.FRONTEND_URL
].filter(Boolean).map(url => url.replace(/\/$/, '')); // Normalize by removing trailing slashes

const io = new Server(httpServer, {
    cors: {
        origin: (origin, callback) => {
            // Allow requests with no origin (like mobile apps or curl requests)
            if (!origin) return callback(null, true);

            if (allowedOrigins.includes(origin)) {
                callback(null, true);
            } else {
                console.log('CORS Blocked for origin:', origin);
                callback(null, false);
            }
        },
        methods: ['GET', 'POST', 'PUT', 'DELETE'],
        credentials: true
    }
});

// Make io accessible to routes
app.set('io', io);

// Connect to MongoDB
connectDB();

// Test Cloudinary connection (optional, won't block startup)
testCloudinaryConnection();

// Middleware
app.use(helmet({
    crossOriginOpenerPolicy: { policy: "unsafe-none" }, // Explicitly allow Firebase Auth popups
    crossOriginResourcePolicy: { policy: "cross-origin" }
})); // Security headers with Firebase Auth support

// Enhanced CORS configuration
app.use(cors({
    origin: (origin, callback) => {
        // Allow requests with no origin (like mobile apps or curl requests)
        if (!origin) return callback(null, true);

        const normalizedOrigin = origin.replace(/\/$/, '');
        if (allowedOrigins.includes(normalizedOrigin)) {
            callback(null, true);
        } else {
            console.log('CORS Blocked for origin:', origin);
            console.log('Allowed Origins were:', allowedOrigins);
            callback(null, false);
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin'],
    exposedHeaders: ['Content-Range', 'X-Content-Range'],
    maxAge: 86400 // 24 hours
}));

// Additional CORS headers for preflight requests
app.use((req, res, next) => {
    const origin = req.headers.origin;
    if (origin && allowedOrigins.includes(origin)) {
        res.header('Access-Control-Allow-Origin', origin);
        res.header('Access-Control-Allow-Credentials', 'true');
        res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
        res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, Origin');
    }

    // Handle preflight requests
    if (req.method === 'OPTIONS') {
        return res.sendStatus(200);
    }

    next();
});

app.use(express.json()); // Body parser
app.use(express.urlencoded({ extended: true }));

// Request logging in development
if (process.env.NODE_ENV === 'development') {
    app.use((req, res, next) => {
        console.log(`${req.method} ${req.path}`);
        next();
    });
}

// Health check route
app.get('/api/health', (req, res) => {
    res.json({
        success: true,
        message: 'Event Orchestration API is running',
        timestamp: new Date().toISOString()
    });
});

// API Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/registration', require('./routes/registration'));
app.use('/api/payment-settings', require('./routes/paymentSettings'));
app.use('/api/queries', require('./routes/queries'));
app.use('/api/admin/participants', require('./routes/admin/participants'));
app.use('/api/admin/subevents', require('./routes/admin/subevents'));
app.use('/api/admin/rounds', require('./routes/admin/rounds'));
app.use('/api/admin/analytics', require('./routes/admin/analytics'));
app.use('/api/admin/settings', require('./routes/admin/settings'));
app.use('/api/admin/payment-settings', require('./routes/admin/paymentSettings'));
app.use('/api/admin/users', require('./routes/admin/manageAdmins'));
app.use('/api/admin/groups', require('./routes/admin/groups'));
app.use('/api/admin/attendance', require('./routes/admin/attendance'));
app.use('/api/admin/queries', require('./routes/admin/queries'));
app.use('/api/participant', require('./routes/participant'));
app.use('/api/admin/panels', require('./routes/admin/panels'));
app.use('/api/admin/topics', require('./routes/admin/topics'));
app.use('/api/judge', require('./routes/judge'));

// Socket.IO connection handling
if (!process.env.JWT_SECRET) {
    console.error('CRITICAL WARNING: JWT_SECRET environment variable is not set! Token verification will fail.');
}
io.on('connection', (socket) => {
    console.log(`✅ Socket connected: ${socket.id}`);

    // Join admin room
    socket.on('join:admin', () => {
        socket.join('admin');
        console.log(`Admin joined: ${socket.id}`);
    });

    // Join sub-event specific room
    socket.on('join:subevent', (subEventId) => {
        socket.join(`subevent:${subEventId}`);
        console.log(`Joined sub-event room: subevent:${subEventId}`);
    });

    // Join panel-specific room (for judges)
    socket.on('join:panel', (panelId) => {
        socket.join(`panel:${panelId}`);
        console.log(`Joined panel room: panel:${panelId}`);
    });

    // Join round-specific room
    socket.on('join:round', (roundId) => {
        socket.join(`round:${roundId}`);
        console.log(`Joined round room: round:${roundId}`);
    });

    // Join participant-specific room
    socket.on('join:participant', (participantId) => {
        socket.join(`participant:${participantId}`);
        console.log(`Joined participant room: participant:${participantId}`);
    });

    // Disconnect
    socket.on('disconnect', () => {
        console.log(`❌ Socket disconnected: ${socket.id}`);
    });
});

// Error handler (must be last)
app.use(errorHandler);

// 404 handler
app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: 'Route not found'
    });
});

// Start server
const PORT = process.env.PORT || 5000;
httpServer.listen(PORT, () => {
    console.log(`
╔════════════════════════════════════════════════════════════╗
║                                                            ║
║   🎯 Event Orchestration Platform - Backend API           ║
║                                                            ║
║   Server running on port: ${PORT}                            ║
║   Environment: ${process.env.NODE_ENV || 'development'}                              ║
║   Socket.IO: Enabled                                       ║
║                                                            ║
╚════════════════════════════════════════════════════════════╝
  `);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
    console.error(`❌ Unhandled Rejection: ${err.message}`);
    // Close server & exit process
    httpServer.close(() => process.exit(1));
});

module.exports = { app, io };
