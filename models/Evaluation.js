const mongoose = require('mongoose');

const EvaluationSchema = new mongoose.Schema({
    groupId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Group',
        required: true
    },
    panelId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Panel',
        required: true
    },
    roundId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Round',
        required: true
    },
    // Judge who evaluated
    judgeEmail: {
        type: String,
        required: true
    },
    judgeName: {
        type: String,
        required: true
    },
    // Scores for each parameter
    scores: [{
        parameterName: {
            type: String,
            required: true
        },
        score: {
            type: Number,
            required: true
        },
        maxScore: {
            type: Number,
            required: true
        }
    }],
    // Total score
    totalScore: {
        type: Number,
        required: true
    },
    maxTotalScore: {
        type: Number,
        required: true
    },
    // Percentage
    percentage: {
        type: Number
    },
    // Judge's comments
    comments: {
        type: String,
        default: ''
    },
    // Judge's recommendation for next round
    recommendForNextRound: {
        type: Boolean,
        default: false
    },
    // Individual participant ratings
    participantRatings: [{
        participantId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Participant'
        },
        scores: [{
            parameterName: String,
            score: Number,
            maxScore: Number
        }],
        totalScore: Number,
        maxTotalScore: Number,
        rating: {
            type: Number,
            min: 1,
            max: 5
        },
        remarks: String,
        selectedForNextRound: {
            type: Boolean,
            default: false
        }
    }],
    // Submission timestamp
    submittedAt: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true
});

// Calculate percentage before saving
EvaluationSchema.pre('save', function () {
    if (this.maxTotalScore > 0) {
        this.percentage = (this.totalScore / this.maxTotalScore) * 100;
    } else {
        this.percentage = 0;
    }
});

// Index for efficient queries
EvaluationSchema.index({ groupId: 1, panelId: 1 });
EvaluationSchema.index({ roundId: 1 });
EvaluationSchema.index({ judgeEmail: 1 });

module.exports = mongoose.model('Evaluation', EvaluationSchema);
