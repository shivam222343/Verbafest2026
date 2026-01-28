const mongoose = require('mongoose');

const systemSettingsSchema = new mongoose.Schema({
    key: {
        type: String,
        required: true,
        unique: true,
        default: 'core_settings'
    },
    eventName: {
        type: String,
        default: 'VerbaFest 2026'
    },
    eventDate: Date,
    registrationDeadline: Date,
    isRegistrationOpen: {
        type: Boolean,
        default: true
    },
    maintenanceMode: {
        type: Boolean,
        default: false
    },
    contactEmail: String,
    maxGlobalParticipants: Number,
    singleEventQrCodeUrl: {
        type: String,
        default: ''
    },
    allEventsQrCodeUrl: {
        type: String,
        default: ''
    },
    availableStreams: {
        type: [String],
        default: ['Computer Science and Engineering']
    },
    availableColleges: {
        type: [String],
        default: ["Kit's college of enginnering, Kolhapur"]
    },
    comboPrice: {
        type: Number,
        default: 150
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('SystemSettings', systemSettingsSchema);
