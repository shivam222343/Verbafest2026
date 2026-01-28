const mongoose = require('mongoose');

const CounterSchema = new mongoose.Schema({
    model: {
        type: String,
        required: true,
        unique: true
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

module.exports = mongoose.model('Counter', CounterSchema);
