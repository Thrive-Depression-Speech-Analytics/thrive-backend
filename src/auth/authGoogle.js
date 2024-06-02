// const firebase = require('../server/firebase');
// const Jwt = require('@hapi/jwt');

// const authGoogle = {
//   googleLoginHandler: async (request, h) => {
//     try {
//       const { token } = request.payload;

//       // Verify the Google token
//       const decodedToken = await firebase.auth().verifyIdToken(token);
//       const { uid, email, name } = decodedToken;

//       // Check if the user already exists in Firestore
//       const userRef = firebase.firestore().collection('users').doc(uid);
//       const userDoc = await userRef.get();

//       if (!userDoc.exists) {
//         // If the user does not exist, create a new user
//         await userRef.set({
//           username: name,
//           email,
//           createdAt: firebase.firestore.FieldValue.serverTimestamp(),
//         });
//       }

//       // Generate JWT (ensure process.env.JWT_SECRET is set)
//       const jwtToken = Jwt.token.generate(
//         { userId: uid }, // Include userId in the payload
//         { key: process.env.JWT_SECRET, algorithm: 'HS256' },
//         { ttlSec: 14400 } // 4 hours
//       );

//       return h.response({ message: 'Login successful', token: jwtToken }).code(200);
//     } catch (error) {
//       console.error('Google login error:', error);
//       return h.response({ message: 'Internal server error' }).code(500);
//     }
//   },
// };

// module.exports = authGoogle;
