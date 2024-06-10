const Joi = require("joi");
const bcrypt = require("bcrypt");
const Jwt = require("@hapi/jwt");
const firebase = require("../server/firebase");
const otpGenerator = require("otp-generator");
const nodemailer = require("nodemailer");

const authService = {
	/**
	 * @function findUserByEmail
	 * @description Mencari pengguna berdasarkan email.
	 * @param {string} email - Email pengguna yang dicari.
	 * @returns {Promise<Object|null>} - Dokumen pengguna yang ditemukan atau null jika tidak ditemukan.
	 */

	findUserByEmail: async email => {
		const usersCollection = firebase.firestore().collection("users");
		const querySnapshot = await usersCollection
			.where("email", "==", email)
			.get();
		return querySnapshot.docs.length > 0 ? querySnapshot.docs[0] : null;
	},

	/**
	 * @function verifyOtp
	 * @description Memverifikasi OTP.
	 * @param {string} otp - OTP yang akan diverifikasi.
	 * @param {Object} userDoc - Dokumen pengguna.
	 * @returns {boolean} - true jika OTP valid dan belum kadaluarsa, false jika tidak valid atau sudah kadaluarsa.
	 */
	verifyOtp: (otp, userDoc) => {
		// Periksa apakah OTP valid dan belum kadaluarsa
		const currentTime = new Date().getTime();
		return (
			otp === userDoc.data().otp && currentTime < userDoc.data().otpExpiresAt
		);
	},

	/**
	 * @function signupHandler
	 * @description Handler untuk mendaftarkan pengguna baru.
	 * @param {Object} request - Objek request.
	 * @param {Object} h - Toolkit respons.
	 * @returns {Promise<Object>} - Objek respons dengan pesan yang menunjukkan bahwa pendaftaran berhasil.
	 */
	signupHandler: async (request, h) => {
		try {
			const { username, password, email } = request.payload;

			if (!username || !password || !email) {
				return h
					.response({ message: "Username, password, and email are required" })
					.code(400);
			}

			const schema = Joi.object({
				username: Joi.string().alphanum().min(3).max(30).required(),
				password: Joi.string().min(8).required(),
				email: Joi.string().email().required(),
			});

			const { error } = schema.validate(request.payload);

			if (error) {
				return h.response({ message: error.details[0].message }).code(400);
			}

			const emailRef = firebase
				.firestore()
				.collection("users")
				.where("email", "==", email);
			const emailDocs = await emailRef.get();

			if (!emailDocs.empty) {
				return h.response({ message: "Email already exists" }).code(409);
			}

			const hashedPassword = await bcrypt.hash(password, 10);

			const userRef = firebase.firestore().collection("users").doc();
			await userRef.set({
				username,
				password: hashedPassword,
				email,
				createdAt: firebase.firestore.FieldValue.serverTimestamp(),
			});

			return h
				.response({ message: "Signup successful", userId: userRef.id })
				.code(201);
		} catch (error) {
			console.error("Error signing up:", error);
			return h.response({ message: "Internal server error" }).code(500);
		}
	},

	/**
	 * @function loginHandler
	 * @description Handler untuk masuk sebagai pengguna.
	 * @param {Object} request - Objek request.
	 * @param {Object} h - Toolkit respons.
	 * @returns {Promise<Object>} - Objek respons dengan pesan yang menunjukkan bahwa masuk berhasil.
	 */
	loginHandler: async (request, h) => {
		try {
			const { email, password } = request.payload;

			if (!email || !password) {
				return h
					.response({ message: "Email and password are required" })
					.code(400);
			}

			const userSnapshot = await firebase
				.firestore()
				.collection("users")
				.where("email", "==", email)
				.get();

			if (userSnapshot.empty) {
				return h.response({ message: "Email not found" }).code(404);
			}

			const userDoc = userSnapshot.docs[0];
			const storedPassword = userDoc.data().password;

			const isMatch = await bcrypt.compare(password, storedPassword);

			if (!isMatch) {
				return h.response({ message: "Invalid password" }).code(401);
			}

			const token = Jwt.token.generate(
				{ userId: userDoc.id }, // Include userId in token payload
				{ key: process.env.JWT_SECRET, algorithm: "HS256" },
				{ ttlSec: 14400 }
			);

			return h.response({ message: "Login successful", token }).code(200);
		} catch (error) {
			console.error("Error logging in:", error);
			return h.response({ message: "Internal server error" }).code(500);
		}
	},

	/**
	 * @function forgotPasswordHandler
	 * @description Handler untuk lupa kata sandi.
	 * @param {Object} request - Objek request.
	 * @param {Object} h - Toolkit respons.
	 * @returns {Promise<Object>} - Objek respons dengan pesan yang menunjukkan bahwa OTP berhasil dikirim.
	 */
	forgotPasswordHandler: async (request, h) => {
		try {
			const { email } = request.payload;

			if (!email) {
				return h.response({ message: "Email is required" }).code(400);
			}

			const userDoc = await authService.findUserByEmail(email);

			if (!userDoc) {
				return h.response({ message: "Email not found" }).code(404);
			}

			const otp = otpGenerator.generate(4, {
				digits: true,
				lowerCaseAlphabets: false,
				upperCaseAlphabets: false,
				specialChars: false,
			});

			await userDoc.ref.update({
				otp,
				otpExpiresAt: new Date().getTime() + 300000, // 5 minutes
			});

			const transporter = nodemailer.createTransport({
				service: "gmail",
				auth: {
					user: "email-anda", // ganti dengan email yang support smtp
					pass: "password-email", // password email
				},
			});

			const mailOptions = {
				from: "email-anda", // ganti dengan email yang support smtp
				to: email,
				subject: "Your OTP for password reset",
				text: `Your OTP is: ${otp}`,
			};

			await transporter.sendMail(mailOptions);

			return h.response({ message: "OTP sent successfully" }).code(200);
		} catch (error) {
			console.error("Error sending OTP:", error);
			return h.response({ message: "Internal server error" }).code(500);
		}
	},

	/**
	 * @function resetPasswordHandler
	 * @description Handler untuk mereset kata sandi pengguna.
	 * @param {Object} request - Objek request.
	 * @param {Object} h - Toolkit respons.
	 * @returns {Promise<Object>} - Objek respons dengan pesan yang menunjukkan bahwa kata sandi berhasil direset.
	 */
	resetPasswordHandler: async (request, h) => {
		try {
			const { email, otp, newPassword } = request.payload;

			if (!email || !otp || !newPassword) {
				return h
					.response({ message: "Email, OTP, and new password are required" })
					.code(400);
			}

			const userSnapshot = await firebase
				.firestore()
				.collection("users")
				.where("email", "==", email)
				.get();

			if (userSnapshot.empty) {
				return h.response({ message: "User not found" }).code(404);
			}

			const userDoc = userSnapshot.docs[0];

			const currentTime = new Date().getTime();
			const otpExpiresAt = userDoc.data().otpExpiresAt;

			if (!otpExpiresAt || currentTime > otpExpiresAt) {
				return h.response({ message: "OTP has expired" }).code(400);
			}

			const isOtpValid = await authService.verifyOtp(otp, userDoc);

			if (!isOtpValid) {
				return h.response({ message: "Invalid OTP" }).code(400);
			}

			const salt = await bcrypt.genSalt(10);
			const hashedPassword = await bcrypt.hash(newPassword, salt);

			await userDoc.ref.update({
				password: hashedPassword,
				otp: null,
				otpExpiresAt: null,
			});

			return h.response({ message: "Password successfully reset" }).code(200);
		} catch (error) {
			console.error("Error resetting password:", error);
			return h.response({ message: "Internal server error" }).code(500);
		}
	},

	/**
	 * @function editUsernameHandler
	 * @description Handler untuk mengubah username pengguna.
	 * @param {Object} request - Objek request.
	 * @param {Object} h - Toolkit respons.
	 * @returns {Promise<Object>} - Objek respons dengan pesan yang menunjukkan bahwa username berhasil diubah.
	 */
	editUsernameHandler: async (request, h) => {
		try {
			const { userId } = request.params;
			const { newUsername } = request.payload;

			if (!userId || !newUsername) {
				return h
					.response({ message: "User ID and new username are required" })
					.code(400);
			}

			const userDoc = await firebase
				.firestore()
				.collection("users")
				.doc(userId)
				.get();

			if (!userDoc.exists) {
				return h.response({ message: "User not found" }).code(404);
			}

			await userDoc.ref.update({ username: newUsername });

			return h.response({ message: "Username successfully changed" }).code(200);
		} catch (error) {
			console.error("Error editing username:", error);
			return h.response({ message: "Internal server error" }).code(500);
		}
	},

	/**
	 * @function changePasswordHandler
	 * @description Handler untuk mengubah kata sandi pengguna.
	 * @param {Object} request - Objek request.
	 * @param {Object} h - Toolkit respons.
	 * @returns {Promise<Object>} - Objek respons dengan pesan yang menunjukkan bahwa kata sandi berhasil diubah.
	 */
	changePasswordHandler: async (request, h) => {
		try {
			const { userId } = request.params;
			const { oldPassword, newPassword } = request.payload;

			if (!userId || !oldPassword || !newPassword) {
				return h
					.response({
						message: "User ID, old password, and new password are required",
					})
					.code(400);
			}

			const userDoc = await firebase
				.firestore()
				.collection("users")
				.doc(userId)
				.get();

			if (!userDoc.exists) {
				return h.response({ message: "User not found" }).code(404);
			}

			const storedPassword = userDoc.data().password;

			const isMatch = await bcrypt.compare(oldPassword, storedPassword);

			if (!isMatch) {
				return h.response({ message: "Invalid old password" }).code(401);
			}

			const hashedNewPassword = await bcrypt.hash(newPassword, 10);

			await userDoc.ref.update({ password: hashedNewPassword });

			return h.response({ message: "Password successfully changed" }).code(200);
		} catch (error) {
			console.error("Error changing password:", error);
			return h.response({ message: "Internal server error" }).code(500);
		}
	},

	/**
	 * @function logoutHandler
	 * @description Handler untuk keluar dari aplikasi.
	 * @param {Object} request - Objek request.
	 * @param {Object} h - Toolkit respons.
	 * @returns {Promise<Object>} - Objek respons dengan pesan yang menunjukkan bahwa keluar berhasil.
	 */
	logoutHandler: async (request, h) => {
		return h.response({ message: "Logged out successfully" }).code(200);
	},
};

module.exports = authService;
