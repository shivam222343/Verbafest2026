const mongoose = require('mongoose');

const roundSchema = new mongoose.Schema({
    subEvent: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'SubEvent',
        required: true
    },
    roundNumber: {
        type: Number,
        required: true
    },
    name: {
        type: String,
        required: true // e.g., "Prelims", "Semifinals", "Finals"
    },
    type: {
        type: String,
        enum: ['individual', 'group'],
        required: true
    },
    status: {
        type: String,
        enum: ['pending', 'active', 'completed'],
        default: 'pending'
    },
    participants: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Participant'
    }],
    winners: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Participant'
    }],
    startTime: Date,
    endTime: Date,
    venue: String,
    instructions: String,
    isElimination: {
        type: Boolean,
        default: true
    }
}, {
    timestamps: true
});

// Ensure a sub-event doesn't have duplicate round numbers
roundSchema.index({ subEvent: 1, roundNumber: 1 }, { unique: true });

module.exports = mongoose.model('Round', roundSchema);
