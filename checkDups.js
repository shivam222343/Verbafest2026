const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, 'backend', '.env') });
const Participant = require('./backend/models/Participant');

async function checkDups() {
    try {
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/event-management');
        console.log('Connected to MongoDB');

        const dups = await Participant.aggregate([
            { $group: { _id: '$prn', count: { $sum: 1 }, names: { $push: '$fullName' }, ids: { $push: '$_id' } } },
            { $match: { count: { $gt: 1 }, _id: { $ne: null } } }
        ]);

        console.log('Duplicate PRNs found:');
        console.log(JSON.stringify(dups, null, 2));

        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

checkDups();
