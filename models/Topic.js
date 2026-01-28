const mongoose = require('mongoose');

const topicSchema = new mongoose.Schema({
    content: {
        type: String,
        required: [true, 'Please provide topic content'],
        trim: true
    },
    subEventId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'SubEvent',
        required: true
    },
    isUsed: {
        type: Boolean,
        default: false
    },
    usedByGroup: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Group',
        default: null
    },
    usedByPanel: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Panel',
        default: null
    },
    usedAt: {
        type: Date,
        default: null
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('Topic', topicSchema);
