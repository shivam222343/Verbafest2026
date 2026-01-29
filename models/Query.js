const mongoose = require('mongoose');

const QuerySchema = new mongoose.Schema({
    fullName: {
        type: String,
        required: [true, 'Full name is required'],
        trim: true
    },
    email: {
        type: String,
        required: [true, 'Email is required'],
        trim: true,
        lowercase: true
    },
    mobile: {
        type: String,
        required: [true, 'Mobile number is required'],
        match: [/^[6-9][0-9]{9}$/, 'Please provide a valid 10-digit Indian mobile number']
    },
    subject: {
        type: String,
        required: [true, 'Subject is required'],
        trim: true
    },
    message: {
        type: String,
        required: [true, 'Message is required'],
        trim: true
    },
    status: {
        type: String,
        enum: ['pending', 'in_progress', 'resolved'],
        default: 'pending'
    },
    adminNotes: {
        type: String,
        default: ''
    },
    resolvedAt: {
        type: Date
    },
    resolvedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Admin'
    }
}, {
    timestamps: true
});

// Index for faster queries
QuerySchema.index({ status: 1, createdAt: -1 });
QuerySchema.index({ email: 1 });
QuerySchema.index({ mobile: 1 });

module.exports = mongoose.model('Query', QuerySchema);
