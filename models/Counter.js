const mongoose = require('mongoose');

const CounterSchema = new mongoose.Schema({
    model: {
        type: String,
        required: true
    },
    field: {
        type: String,
        required: true
    },
    count: {
        type: Number,
        default: 0
    }
});

// Compound index to ensure uniqueness for each model's counter fields
CounterSchema.index({ model: 1, field: 1 }, { unique: true });

module.exports = mongoose.model('Counter', CounterSchema);
