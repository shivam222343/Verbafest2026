const mongoose = require('mongoose');

const paymentSettingsSchema = new mongoose.Schema({
    // UPI Payment Details
    upiId: {
        type: String,
        required: true,
        default: 'admin@upi'
    },
    accountName: {
        type: String,
        required: true,
        default: 'Event Management'
    },

    // Discount Settings
    bulkRegistrationDiscount: {
        enabled: {
            type: Boolean,
            default: false
        },
        minEvents: {
            type: Number,
            default: 3,
            min: 2
        },
        discountType: {
            type: String,
            enum: ['percentage', 'fixed'],
            default: 'percentage'
        },
        discountValue: {
            type: Number,
            default: 10,
            min: 0
        }
    },

    // QR Code Settings
    qrCodeEnabled: {
        type: Boolean,
        default: true
    },

    // Payment Instructions
    paymentInstructions: {
        type: String,
        default: 'Please complete the payment and upload the screenshot'
    },

    // Active status
    isActive: {
        type: Boolean,
        default: true
    },

    // Metadata
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Admin'
    },
    updatedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Admin'
    }
}, {
    timestamps: true
});

// Ensure only one active settings document
paymentSettingsSchema.index({ isActive: 1 }, { unique: true, partialFilterExpression: { isActive: true } });

// Static method to get active settings
paymentSettingsSchema.statics.getActiveSettings = async function () {
    let settings = await this.findOne({ isActive: true });

    // Create default settings if none exist
    if (!settings) {
        settings = await this.create({
            upiId: 'admin@upi',
            accountName: 'Event Management',
            isActive: true
        });
    }

    return settings;
};

// Method to calculate discount
paymentSettingsSchema.methods.calculateDiscount = function (totalAmount, eventCount) {
    if (!this.bulkRegistrationDiscount.enabled) {
        return 0;
    }

    if (eventCount < this.bulkRegistrationDiscount.minEvents) {
        return 0;
    }

    if (this.bulkRegistrationDiscount.discountType === 'percentage') {
        return (totalAmount * this.bulkRegistrationDiscount.discountValue) / 100;
    } else {
        return this.bulkRegistrationDiscount.discountValue;
    }
};

module.exports = mongoose.model('PaymentSettings', paymentSettingsSchema);
