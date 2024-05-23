// src/config/firebase.js

const firebase = require("firebase-admin");
require("dotenv").config();

const serviceAccount = {
	projectId: process.env.FIREBASE_PROJECT_ID,
	clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
	privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
};

firebase.initializeApp({
	credential: firebase.credential.cert(serviceAccount),
});

module.exports = firebase;
