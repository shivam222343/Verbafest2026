const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const Counter = require('./Counter');

const ParticipantSchema = new mongoose.Schema({
    // Personal Information
    fullName: {
        type: String,
        required: [true, 'Please provide full name'],
        trim: true
    },
    email: {
        type: String,
        required: [true, 'Please provide email'],
        unique: true,
        lowercase: true,
        match: [
            /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/,
            'Please provide a valid email'
        ]
    },
    mobile: {
        type: String,
        required: [true, 'Please provide mobile number'],
        unique: true,
        match: [/^[0-9]{10}$/, 'Please provide a valid 10-digit mobile number']
    },
    prn: {
        type: String,
        unique: true,
        sparse: true,
        trim: true,
        uppercase: true
    },
    branch: {
        type: String,
        trim: true
    },
    year: {
        type: Number,
        min: 1,
        max: 4
    },
    college: {
        type: String,
        trim: true
    },

    chestNumber: {
        type: Number,
        unique: true,
        sparse: true
    },

    // Registration Details
    registeredSubEvents: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'SubEvent'
    }],

    registrationStatus: {
        type: String,
        enum: ['pending', 'approved', 'rejected', 'incomplete'],
        default: 'incomplete'
    },

    // Payment Information
    transactionId: {
        type: String,
        sparse: true,
        trim: true
    },
    paidAmount: {
        type: Number
    },
    paymentProofUrl: {
        type: String
    },

    // Status per sub-event (dynamic tracking)
    // Format: { subEventId: { status: 'not_started' | 'active_round_X' | 'eliminated_round_X' | 'winner', currentRound: roundId } }
    statusPerSubEvent: {
        type: Map,
        of: {
            status: {
                type: String,
                enum: ['not_started', 'active', 'eliminated', 'winner', 'qualified'],
                default: 'not_started'
            },
            currentRound: {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'Round',
                default: null
            },
            roundNumber: {
                type: Number,
                default: 0
            }
        },
        default: {}
    },

    // Global availability status
    currentStatus: {
        type: String,
        enum: ['available', 'busy', 'registered', 'qualified', 'rejected'],
        default: 'registered'
    },

    currentEvent: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'SubEvent',
        default: null
    },

    // Admin notes
    adminNotes: {
        type: String,
        default: ''
    },

    // Attendance Tracking
    attendance: {
        // Overall event attendance
        overall: {
            isPresent: {
                type: Boolean,
                default: false
            },
            markedAt: {
                type: Date
            },
            markedBy: {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'User'
            }
        },
        // Sub-event specific attendance
        subEvents: [{
            subEventId: {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'SubEvent',
                required: true
            },
            isPresent: {
                type: Boolean,
                default: false
            },
            markedAt: {
                type: Date
            },
            markedBy: {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'User'
            }
        }]
    },

    password: {
        type: String,
        minlength: 6,
        select: false
    }
}, {
    timestamps: true
});

// Auto-increment Chest Number before saving new participant
ParticipantSchema.pre('save', async function () {
    if (this.isNew) {
        try {
            console.log(`Generating chest number for ${this.fullName}...`);
            const counter = await Counter.findOneAndUpdate(
                { model: 'Participant', field: 'chestNumber' },
                { $inc: { count: 1 } },
                { new: true, upsert: true }
            );
            this.chestNumber = counter.count;
            console.log(`Assigned chest number: ${this.chestNumber}`);
        } catch (error) {
            console.error('Error in chestNumber pre-save hook:', error);
            throw error;
        }
    }
});

// Encrypt password before saving
ParticipantSchema.pre('save', async function () {
    if (!this.isModified('password') || !this.password) {
        return;
    }

    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
});

// Sign JWT and return
ParticipantSchema.methods.getSignedJwtToken = function () {
    return jwt.sign(
        { id: this._id, role: 'participant' },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRE }
    );
};

// Match password
ParticipantSchema.methods.matchPassword = async function (enteredPassword) {
    if (!this.password) return false;
    return await bcrypt.compare(enteredPassword, this.password);
};

// Check if participant is busy in any round
ParticipantSchema.methods.isBusy = function () {
    if (!this.statusPerSubEvent || this.statusPerSubEvent.size === 0) {
        return false;
    }

    for (const [, status] of this.statusPerSubEvent) {
        if (status.status === 'active') {
            return true;
        }
    }
    return false;
};

// Get participant's status for a specific sub-event
ParticipantSchema.methods.getSubEventStatus = function (subEventId) {
    return this.statusPerSubEvent.get(subEventId.toString()) || {
        status: 'not_started',
        currentRound: null,
        roundNumber: 0
    };
};

// Update status for a sub-event
ParticipantSchema.methods.updateSubEventStatus = async function (subEventId, status, roundId = null, roundNumber = 0) {
    this.statusPerSubEvent.set(subEventId.toString(), {
        status,
        currentRound: roundId,
        roundNumber
    });

    // Update global availability
    this.isAvailable = !this.isBusy();

    await this.save();
};

module.exports = mongoose.model('Participant', ParticipantSchema);
