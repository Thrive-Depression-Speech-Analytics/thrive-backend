const Joi = require("joi");
const bcrypt = require("bcrypt");
const Jwt = require("@hapi/jwt");
const firebase = require("../server/firebase");

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

      const { error } = schema.validate(request.payload);
      if (error) {
        return h.response({ message: error.details[0].message }).code(400);
      }

      // Periksa apakah email sudah ada
      const emailRef = firebase.firestore().collection("users").where("email", "==", email);
      const emailDocs = await emailRef.get();
      if (!emailDocs.empty) {
        return h.response({ message: "Email sudah ada" }).code(409);
      }

      // Hash password (bcrypt)
      const hashedPassword = await bcrypt.hash(password, 10);

      // Simpan pengguna di Firestore (gunakan ID dokumen Firestore yang auto-generated)
      const userRef = firebase.firestore().collection("users").doc();
      await userRef.set({
        username,
        password: hashedPassword,
        email,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      });

      return h.response({ message: "Pendaftaran berhasil", userId: userRef.id }).code(201);
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

      // Ambil pengguna dari Firestore berdasarkan email
      const userRef = firebase.firestore().collection("users").where("email", "==", email);
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

      // Generate JWT (pastikan process.env.JWT_SECRET sudah diatur)
      const token = Jwt.token.generate(
        { userId: userDocs.docs[0].id }, // Sertakan userId dalam payload
        { key: process.env.JWT_SECRET, algorithm: "HS256" },
        { ttlSec: 14400 } // 4 jam
      );

      return h.response({ message: "Login berhasil", token }).code(200);
    } catch (error) {
      console.error("Kesalahan login:", error);
      return h.response({ message: "Kesalahan server internal" }).code(500);
    }
  },
};

module.exports = authService;
