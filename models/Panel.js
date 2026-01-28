const mongoose = require('mongoose');

const PanelSchema = new mongoose.Schema({
    subEventId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'SubEvent',
        required: true
    },
    roundId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Round',
        required: false
    },
    panelNumber: {
        type: Number,
        required: true
    },
    panelName: {
        type: String,
        required: true
    },
    // Judge details
    judges: [{
        name: {
            type: String,
            required: true
        },
        email: {
            type: String,
            required: true
        },
        phone: String,
        // Unique access code for this judge
        accessCode: {
            type: String,
            required: true,
            unique: true
        },
        // Track if judge has logged in
        hasAccessed: {
            type: Boolean,
            default: false
        },
        lastAccessedAt: Date
    }],
    // Assigned groups
    assignedGroups: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Group'
    }],
    // Evaluation parameters for this panel
    evaluationParameters: [{
        name: {
            type: String,
            required: true
        },
        maxScore: {
            type: Number,
            required: true,
            default: 10
        },
        weight: {
            type: Number,
            default: 1 // For weighted scoring
        }
    }],
    // Panel status
    status: {
        type: String,
        enum: ['setup', 'active', 'completed'],
        default: 'setup'
    },
    // Venue/location
    venue: String,
    // Notes for judges
    instructions: String
}, {
    timestamps: true
});

// Generate unique access code
PanelSchema.methods.generateAccessCode = function () {
    return Math.random().toString(36).substring(2, 10).toUpperCase();
};

// Index for efficient queries
PanelSchema.index({ subEventId: 1, roundId: 1 });

module.exports = mongoose.model('Panel', PanelSchema);
