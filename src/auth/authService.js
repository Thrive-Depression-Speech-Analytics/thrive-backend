const Joi = require("joi");
const bcrypt = require("bcrypt");
const Jwt = require("@hapi/jwt");
const firebase = require("../server/firebase");
const otpGenerator = require("otp-generator");
const nodemailer = require("nodemailer");

/**
 * Layanan autentikasi.
 * @namespace
 */

const authService = {
  /**
   * Mencari pengguna berdasarkan email.
   * @param {string} email - Email pengguna yang dicari.
   * @returns {Promise<Object|null>} - Dokumen pengguna yang ditemukan atau null jika tidak ditemukan.
   */

  findUserByEmail: async (email) => {
    const usersCollection = firebase.firestore().collection("users");
    const querySnapshot = await usersCollection.where("email", "==", email).get();
    return querySnapshot.docs.length > 0 ? querySnapshot.docs[0] : null;
  },

  /**
   * Memverifikasi OTP.
   * @param {string} otp - OTP yang akan diverifikasi.
   * @param {Object} userDoc - Dokumen pengguna.
   * @returns {boolean} - true jika OTP valid dan belum kadaluarsa, false jika tidak valid atau sudah kadaluarsa.
   */
  verifyOtp: (otp, userDoc) => {
    // Periksa apakah OTP valid dan belum kadaluarsa
    const currentTime = new Date().getTime();
    return otp === userDoc.data().otp && currentTime < userDoc.data().otpExpiresAt;
  },

  /**
   * Penanganan pendaftaran pengguna.
   * @param {Object} request - Objek permintaan.
   * @param {Object} h - Objek respons.
   * @returns {Promise<Object>} - Objek respons dengan pesan dan ID pengguna.
   */
  signupHandler: async (request, h) => {
    try {
      const { username, password, email } = request.payload;

      // Validasi input menggunakan Joi
      const schema = Joi.object({
        username: Joi.string().alphanum().min(3).max(30).required().messages({
          "string.alphanum": "Username hanya boleh mengandung huruf dan angka",
          "string.min": "Username minimal harus memiliki 3 karakter",
          "string.max": "Username maksimal harus memiliki 30 karakter",
          "any.required": "Username harus diisi",
        }),
        password: Joi.string().min(8).required().messages({
          "string.min": "Password minimal harus memiliki 8 karakter",
          "any.required": "Password harus diisi",
        }),
        email: Joi.string().email().required().messages({
          "string.email": "Email harus memiliki format yang valid",
          "any.required": "Email harus diisi",
        }),
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

      // Hash password menggunakan bcrypt
      const hashedPassword = await bcrypt.hash(password, 10);

      // Simpan pengguna di Firestore (gunakan ID dokumen Firestore yang dihasilkan secara otomatis)
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

  /**
   * Penanganan login pengguna.
   * @param {Object} request - Objek permintaan.
   * @param {Object} h - Objek respons.
   * @returns {Promise<Object>} - Objek respons dengan pesan dan token JWT.
   */
  loginHandler: async (request, h) => {
    try {
      const { email, password } = request.payload;

      // Validasi input menggunakan Joi
      const schema = Joi.object({
        email: Joi.string().email().required().messages({
          "string.email": "Email harus memiliki format yang valid",
          "any.required": "Email harus diisi",
        }),
        password: Joi.string().required().messages({
          "any.required": "Password harus diisi",
        }),
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

      // Bandingkan hash password menggunakan bcrypt
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

  /**
   * Penanganan lupa password.
   * @param {Object} request - Objek permintaan.
   * @param {Object} h - Objek respons.
   * @returns {Promise<Object>} - Objek respons dengan pesan bahwa OTP berhasil dikirim.
   */
  forgotPasswordHandler: async (request, h) => {
    try {
      const { email } = request.payload;

      // Validasi input menggunakan Joi
      const schema = Joi.object({
        email: Joi.string().email().required().messages({
          "string.email": "Email harus memiliki format yang valid",
          "any.required": "Email harus diisi",
        }),
      });
      const { error } = schema.validate(request.payload);
      if (error) {
        return h.response({ message: error.details[0].message }).code(400);
      }

      // Periksa apakah pengguna ada
      const userDoc = await authService.findUserByEmail(email);
      if (!userDoc) {
        return h.response({ message: "Email tidak ditemukan" }).code(404);
      }

      // Generate OTP
      const otp = otpGenerator.generate(6, {
        digits: true,
        lowerCaseAlphabets: false,
        upperCaseAlphabets: false,
        specialChars: false,
      });

      // Simpan OTP ke dokumen pengguna
      await userDoc.ref.update({
        otp,
        otpExpiresAt: new Date().getTime() + 300000, // 5 menit
      });

      // Kirim OTP melalui email
      const transporter = nodemailer.createTransport({
        service: "gmail", // Gunakan layanan email pilihan Anda
        auth: {
          user: "12220290@bsi.ac.id", // Ganti dengan alamat email Anda
          pass: "Kidut255!", // Ganti dengan kata sandi email Anda
        },
      });

      const mailOptions = {
        from: "12220290@bsi.ac.id", // Ganti dengan alamat email Anda
        to: email,
        subject: "Kode OTP Anda",
        text: `Kode OTP Anda adalah: ${otp}`,
      };

      await transporter.sendMail(mailOptions);

      return h.response({ message: "OTP berhasil dikirim" }).code(200);
    } catch (error) {
      console.error("Kesalahan lupa password:", error);
      return h.response({ message: "Kesalahan server internal" }).code(500);
    }
  },

  /**
   * Penanganan reset password.
   * @param {Object} request - Objek permintaan.
   * @param {Object} h - Objek respons.
   * @returns {Promise<Object>} - Objek respons dengan pesan bahwa password berhasil diubah.
   */
  resetPasswordHandler: async (request, h) => {
    const { email, otp, newPassword } = request.payload;

    // Dapatkan dokumen pengguna dari Firestore
    const userSnapshot = await firebase.firestore().collection("users").where("email", "==", email).get();

    // Jika pengguna tidak ada, kembalikan respons error
    if (userSnapshot.empty) {
      return h.response({ message: "Pengguna tidak ditemukan" }).code(404);
    }

    // Get the first document from the snapshot
    const userDoc = userSnapshot.docs[0];

    // Periksa apakah OTP sudah kadaluarsa
    const currentTime = new Date().getTime();
    const otpExpiresAt = userDoc.data().otpExpiresAt;

    if (!otpExpiresAt || currentTime > otpExpiresAt) {
      return h.response({ message: "OTP telah kadaluarsa" }).code(400);
    }

    // Verifikasi OTP
    const isOtpValid = await authService.verifyOtp(otp, userDoc);

    // Jika OTP tidak valid, kembalikan respons error
    if (!isOtpValid) {
      return h.response({ message: "OTP tidak valid" }).code(400);
    }

    // Jika OTP valid, perbarui password dan hapus OTP
    try {
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(newPassword, salt);

      // Perbarui dokumen pengguna di Firestore dengan password baru dan hapus OTP
      await userDoc.ref.update({
        password: hashedPassword,
        otp: null,
        otpExpiresAt: null,
      });

      return h.response({ message: "Password berhasil diubah" }).code(200);
    } catch (error) {
      console.error("Kesalahan reset password:", error);
      return h.response({ message: "Kesalahan server internal" }).code(500);
    }
  },

  /**
   * Handler ganti username.
   * @param {Object} request - Objek permintaan.
   * @param {Object} h - Objek respons.
   * @returns {Promise<Object>} - Objek respons dengan pesan bahwa username berhasil diubah.
   */

  editUsernameHandler: async (request, h) => {
    try {
      const { userId } = request.params.userId;
      const { newUsername } = request.payload;

      // Validasi input username baru
      const schema = Joi.object({
        newUsername: Joi.string().alphanum().min(3).max(30).required().messages({
          "string.alphanum": "Username hanya boleh mengandung huruf dan angka",
          "string.min": "Username minimal harus memiliki 3 karakter",
          "string.max": "Username maksimal harus memiliki 30 karakter",
          "any.required": "Username harus diisi",
        }),
      });

      const { error } = schema.validate({ newUsername });
      if (error) {
        return h.response({ message: error.details[0].message }).code(400);
      }

      // memeriksa jika username baru sudah ada
      const usernameRef = firebase.firestore().collection("users").where("username", "==", newUsername);
      const usernameDocs = await usernameRef.get();
      if (!usernameDocs.empty) {
        return h.response({ message: "Username sudah ada" }).code(409);
      }

      // memperbarui username di Firestore
      const userRef = firebase.firestore().collection("users").doc(userId);
      await userRef.update({
        username: newUsername,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      });

      return h.response({ message: "Username berhasil diubah" }).code(200);
    } catch (error) {
      console.error("Kesalahan mengganti username:", error);
      return h.response({ message: "Kesalahan server internal" }).code(500);
    }
  },

  /**
   * Handler ganti password.
   * @param {Object} request - Objek permintaan.
   * @param {Object} h - Objek respons.
   * @returns {Promise<Object>} - Objek respons dengan pesan bahwa password berhasil diubah.
   */

  editPasswordHandler: async (request, h) => {
    try {
      const { userId } = request.params;
      const { currentPassword, newPassword } = request.payload;

      // Input validation
      const schema = Joi.object({
        currentPassword: Joi.string().required().messages({
          "any.required": "Password saat ini harus diisi",
        }),
        newPassword: Joi.string().min(8).required().messages({
          "string.min": "Password baru minimal harus memiliki 8 karakter",
          "any.required": "Password baru harus diisi",
        }),
      });

      const validationMessage = validateInput(schema, { currentPassword, newPassword });
      if (validationMessage) {
        return h.response({ message: validationMessage }).code(400);
      }

      // Mengambil user dari Firestore menggunakan userId
      const userRef = firebase.firestore().collection("users").doc(userId);
      const userDoc = await userRef.get();
      if (!userDoc.exists) {
        return h.response({ message: "Pengguna tidak ditemukan" }).code(404);
      }

      const userData = userDoc.data();

      // Verifikasi membandingkan persamaan password
      const passwordMatch = await bcrypt.compare(currentPassword, userData.password);
      if (!passwordMatch) {
        return h.response({ message: "Password saat ini salah" }).code(401);
      }

      // Hash password menggunakan bcrypt
      const hashedNewPassword = await bcrypt.hash(newPassword, 10);

      // Update user password di Firestore
      await userRef.update({
        password: hashedNewPassword,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      });

      return h.response({ message: "Password berhasil diubah" }).code(200);
    } catch (error) {
      console.error("Kesalahan mengubah password:", error);
      return h.response({ message: "Kesalahan server internal" }).code(500);
    }
  },

  logoutHandler: async (request, h) => {
    try {
      return h.response({ message: "Logout berhasil." }).code(200);
    } catch (error) {
      console.error("Kesalahan saat logout:", error);
      return h.response({ message: "Kesalahan server internal" }).code(500);
    }
  },
};

module.exports = authService;
