require('dotenv').config();
const mongoose = require('mongoose');
const Participant = require('./models/Participant');
const Counter = require('./models/Counter');

const populateChestNumbers = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to MongoDB');

        const participants = await Participant.find({ chestNumber: { $exists: false } }).sort({ createdAt: 1 });
        console.log(`Found ${participants.length} participants without chest numbers`);

        let counter = await Counter.findOne({ model: 'Participant', field: 'chestNumber' });
        let currentCount = counter ? counter.count : 0;

        for (const participant of participants) {
            currentCount++;
            await Participant.updateOne({ _id: participant._id }, { $set: { chestNumber: currentCount } });
            console.log(`Assigned chest number ${currentCount} to ${participant.fullName}`);
        }

        await Counter.findOneAndUpdate(
            { model: 'Participant', field: 'chestNumber' },
            { count: currentCount },
            { upsert: true }
        );

        console.log('Finished populating chest numbers');
        process.exit(0);
    } catch (error) {
        console.error('Error Details:', JSON.stringify(error, null, 2));
        console.error('Error Message:', error.message);
        process.exit(1);
    }
};

populateChestNumbers();
