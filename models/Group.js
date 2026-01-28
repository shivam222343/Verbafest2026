const mongoose = require('mongoose');

const GroupSchema = new mongoose.Schema({
    subEventId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'SubEvent',
        required: true
    },
    roundId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Round',
        required: true
    },
    groupNumber: {
        type: Number,
        required: true
    },
    groupName: {
        type: String,
        default: function () {
            return `Group ${this.groupNumber}`;
        }
    },
    participants: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Participant'
    }],
    panelId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Panel',
        default: null
    },
    // Evaluation status
    evaluationStatus: {
        type: String,
        enum: ['pending', 'in_progress', 'completed'],
        default: 'pending'
    },
    // Average score from all judges
    averageScore: {
        type: Number,
        default: 0
    },
    // Whether this group is selected for next round
    selectedForNextRound: {
        type: Boolean,
        default: false
    },
    // Admin confirmation of judge selection
    adminConfirmed: {
        type: Boolean,
        default: false
    },
    // Performance slot timing
    performanceSlot: {
        startTime: Date,
        endTime: Date
    }
}, {
    timestamps: true
});

// Index for efficient queries
GroupSchema.index({ subEventId: 1, roundId: 1 });
GroupSchema.index({ panelId: 1 });

module.exports = mongoose.model('Group', GroupSchema);
