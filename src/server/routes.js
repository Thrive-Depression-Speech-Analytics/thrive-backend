const Joi = require("joi");
const bcrypt = require("bcrypt");
const Jwt = require("@hapi/jwt");
const firebase = require("./firebase");
const { v4: uuidv4 } = require("uuid");

const authService = {
    signupHandler: async (request, h) => {
        try {
            const { username, password, email } = request.payload;

            // Validasi Input (Joi)
            const schema = Joi.object({
                username: Joi.string().alphanum().min(3).max(30).required(),
                password: Joi.string().min(8).required(),
                email: Joi.string().email().required(),
            });

            const { error, value } = schema.validate(request.payload);
            if (error) {
                return h.response({ message: error.details[0].message }).code(400);
            }

            // Periksa apakah user sudah ada
            const userRef = firebase.firestore().collection("users").doc(username);
            const userDoc = await userRef.get();
            if (userDoc.exists) {
                return h.response({ message: "Username sudah ada" }).code(409);
            }

            const userId = uuidv4();

            // Hash password (bcrypt)
            const hashedPassword = await bcrypt.hash(password, 10);

            // Simpan user di Firestore (dengan userId dan createdAt)
            await userRef.set({
                userId,
                username,
                password: hashedPassword,
                email,
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            });

            return h.response({ message: "Pendaftaran berhasil", userId }).code(201);
        } catch (error) {
            console.error("Kesalahan pendaftaran:", error);
            return h.response({ message: "Kesalahan server internal" }).code(500);
        }
    },

    loginHandler: async (request, h) => {
        try {
            const { email, password } = request.payload;

            // Validasi Input (Joi)
            const schema = Joi.object({
                email: Joi.string().email().required(),
                password: Joi.string().required(),
            });

            const { error, value } = schema.validate(request.payload);
            if (error) {
                return h.response({ message: error.details[0].message }).code(400);
            }

            // Ambil user dari Firestore
            const userRef = firebase
                .firestore()
                .collection("users")
                .where("email", "==", email);
            const userDocs = await userRef.get();
            if (userDocs.empty) {
                return h.response({ message: "Kredensial tidak valid" }).code(401);
            }

            // Bandingkan hash password (bcrypt)
            const storedPassword = userDocs.docs[0].data().password;
            const passwordMatch = await bcrypt.compare(password, storedPassword);
            if (!passwordMatch) {
                return h.response({ message: "Kredensial tidak valid" }).code(401);
            }

            // Generate JWT
            const token = Jwt.token.generate(
                { email },
                { key: process.env.JWT_SECRET, algorithm: "HS256" },
                { ttlSec: 14400 } // 4 jam
            );

            return h.response({ "Login berhasil": token }).code(200);
        } catch (error) {
            console.error("Kesalahan login:", error);
            return h.response({ message: "Kesalahan server internal" }).code(500);
        }
    },
};

module.exports = [
    
    {
        method: "POST",
        path: "/register",
        options: { auth: false },
        handler: authService.signupHandler,
    },
    
    {
        method: "POST",
        path: "/login",
        options: { auth: false },
        handler: authService.loginHandler,
    },
];
