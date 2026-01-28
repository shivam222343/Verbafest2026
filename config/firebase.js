const admin = require('firebase-admin');

// Note: In a real production environment, you should use a service account JSON file.
// For this setup, we'll try to use environment variables if available, 
// otherwise we'll warn the user.

const initializeFirebase = () => {
    try {
        let serviceAccount;

        // Try loading from file first
        try {
            const fs = require('fs');
            const path = require('path');
            const filePath = path.join(__dirname, '../service-account.json');
            if (fs.existsSync(filePath)) {
                serviceAccount = JSON.parse(fs.readFileSync(filePath, 'utf8'));
            }
        } catch (fileErr) {
            console.warn('ℹ️ service-account.json not found, falling back to environment variable');
        }

        // Fallback to environment variable
        if (!serviceAccount && process.env.FIREBASE_SERVICE_ACCOUNT) {
            serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
        }

        if (serviceAccount) {
            admin.initializeApp({
                credential: admin.credential.cert(serviceAccount)
            });
            console.log('✅ Firebase Admin initialized');
        } else {
            console.warn('⚠️ Firebase Admin not initialized: No service account found (.env or json file)');
        }
    } catch (error) {
        console.error('❌ Firebase Admin initialization error:', error.message);
    }
};

module.exports = { admin, initializeFirebase };
