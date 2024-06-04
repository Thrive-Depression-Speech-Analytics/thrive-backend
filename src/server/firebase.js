const admin = require("firebase-admin");

const serviceAccount = require("./thrive-dev-424108-firebase-adminsdk-ko2m8-63ad7a2eec.json");

const app = admin.initializeApp({
	credential: admin.credential.cert(serviceAccount),
});

const auth = admin.auth(app);
const db = admin.firestore(app);

module.exports = { auth, db };
