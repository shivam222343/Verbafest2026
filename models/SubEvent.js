const mongoose = require('mongoose');

const SubEventSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Please provide sub-event name'],
        trim: true,
        unique: true
    },
    description: {
        type: String,
        required: [true, 'Please provide description']
    },
    type: {
        type: String,
        enum: ['individual', 'group'],
        required: [true, 'Please specify event type']
    },
    registrationPrice: {
        type: Number,
        default: 50
    },
    // Group-based event settings
    groupSizeRange: {
        min: {
            type: Number,
            default: 1
        },
        max: {
            type: Number,
            default: 10
        }
    },
    panelCount: {
        type: Number,
        default: 1,
        min: 1
    },
    // Registration settings
    isActiveForRegistration: {
        type: Boolean,
        default: true
    },
    maxParticipants: {
        type: Number,
        default: null // null means unlimited
    },
    registrationDeadline: {
        type: Date,
        default: null
    },
    // Event timing (optional - for reference only)
    startTime: {
        type: Date,
        default: null
    },
    // Event status - controlled by admin
    status: {
        type: String,
        enum: ['not_started', 'active', 'completed'],
        default: 'not_started'
    },
    // Actual start time when admin manually starts the event
    actualStartTime: {
        type: Date,
        default: null
    },
    // Actual end time when admin manually ends the event
    actualEndTime: {
        type: Date,
        default: null
    },
    // Accent color for UI
    accentColor: {
        type: String,
        enum: ['mindSaga', 'gd', 'debate'],
        default: 'mindSaga'
    },
    // WhatsApp group link for participants
    whatsappGroupLink: {
        type: String,
        default: ''
    },
    // Rounds will be added dynamically
    rounds: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Round'
    }],
    // Statistics
    totalRegistrations: {
        type: Number,
        default: 0
    },
    approvedParticipants: {
        type: Number,
        default: 0
    }
}, {
    timestamps: true
});

// Update registration count
SubEventSchema.methods.updateRegistrationCount = async function () {
    const Participant = mongoose.model('Participant');
    const count = await Participant.countDocuments({
        registeredSubEvents: this._id,
        registrationStatus: 'approved'
    });
    this.approvedParticipants = count;
    await this.save();
};

module.exports = mongoose.model('SubEvent', SubEventSchema);
