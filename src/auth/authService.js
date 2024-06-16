const Joi = require("joi");
const bcrypt = require("bcrypt");
const Jwt = require("@hapi/jwt");
const firebase = require("../server/firebase");
const otpGenerator = require("otp-generator");
const nodemailer = require("nodemailer");

const authService = {
	/**
	 * Finds a user by their email address.
	 * @param {string} email - The email address to search for.
	 * @returns {Promise<Object|null>} - The user document if found, otherwise null.
	 */
	findUserByEmail: async email => {
		const usersCollection = firebase.firestore().collection("users");
		const querySnapshot = await usersCollection
			.where("email", "==", email)
			.get();
		return querySnapshot.docs.length > 0 ? querySnapshot.docs[0] : null;
	},

	/**
	 * Verifies an OTP code against a user's document.
	 * @param {string} otp - The OTP code to verify.
	 * @param {Object} userDoc - The user document.
	 * @returns {boolean} - True if the OTP is valid and not expired, otherwise false.
	 */
	verifyOtp: (otp, userDoc) => {
		const currentTime = new Date().getTime();
		return (
			otp === userDoc.data().otp && currentTime < userDoc.data().otpExpiresAt
		);
	},

	/**
	 * Handles user signup.
	 * @param {Object} request - The request object.
	 * @param {Object} h - The response toolkit.
	 * @returns {Promise<Object>} - The response object with a success message.
	 */
	signupHandler: async (request, h) => {
		try {
			const { username, password, email } = request.payload;

			// Validate input
			const schema = Joi.object({
				username: Joi.string().alphanum().min(3).max(30).required(),
				password: Joi.string().min(8).required(),
				email: Joi.string().email().required(),
			});

			const { error } = schema.validate(request.payload);

			if (error) {
				return h.response({ message: error.details[0].message }).code(400);
			}

			// Check if email already exists
			const emailRef = firebase
				.firestore()
				.collection("users")
				.where("email", "==", email);
			const emailDocs = await emailRef.get();

			if (!emailDocs.empty) {
				return h.response({ message: "Email already exists" }).code(409);
			}

			// Hash password
			const hashedPassword = await bcrypt.hash(password, 10);

			// Create new user document
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
	 * Handles user login.
	 * @param {Object} request - The request object.
	 * @param {Object} h - The response toolkit.
	 * @returns {Promise<Object>} - The response object with a success message and JWT token.
	 */
	loginHandler: async (request, h) => {
		try {
			const { email, password } = request.payload;

			// Validate input
			if (!email || !password) {
				return h
					.response({ message: "Email and password are required" })
					.code(400);
			}

			// Find user by email
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

			// Compare passwords
			const isMatch = await bcrypt.compare(password, storedPassword);

			if (!isMatch) {
				return h.response({ message: "Invalid password" }).code(401);
			}

			// Generate JWT token
			const token = Jwt.token.generate(
				{ userId: userDoc.id }, // Include userId in token payload
				{ key: process.env.JWT_SECRET, algorithm: "HS256" },
				{ ttlSec: 14400 }
			);

			// Return JWT token and user ID in the response
			return h
				.response({ message: "Login successful", token, userId: userDoc.id })
				.code(200);
		} catch (error) {
			console.error("Error logging in:", error);
			return h.response({ message: "Internal server error" }).code(500);
		}
	},

	/**
	 * Handles forgotten password requests.
	 * @param {Object} request - The request object.
	 * @param {Object} h - The response toolkit.
	 * @returns {Promise<Object>} - The response object with a success message.
	 */
	forgotPasswordHandler: async (request, h) => {
		try {
			const { email } = request.payload;

			// Validate input
			if (!email) {
				return h.response({ message: "Email is required" }).code(400);
			}

			// Find user by email
			const userDoc = await authService.findUserByEmail(email);

			if (!userDoc) {
				return h.response({ message: "Email not found" }).code(404);
			}

			// Generate OTP
			const otp = otpGenerator.generate(4, {
				digits: true,
				lowerCaseAlphabets: false,
				upperCaseAlphabets: false,
				specialChars: false,
			});

			// Update user document with OTP
			await userDoc.ref.update({
				otp,
				otpExpiresAt: new Date().getTime() + 300000, // 5 minutes
			});

			// Send OTP via email
			const transporter = nodemailer.createTransport({
				service: "gmail",
				auth: {
					user: "email-anda", // Replace with your email
					pass: "password-email", // Replace with your email password
				},
			});

			const mailOptions = {
				from: "email-anda", // Replace with your email
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
	 * Handles password reset requests.
	 * @param {Object} request - The request object.
	 * @param {Object} h - The response toolkit.
	 * @returns {Promise<Object>} - The response object with a success message.
	 */
	resetPasswordHandler: async (request, h) => {
		try {
			const { email, otp, newPassword } = request.payload;

			// Validate input
			if (!email || !otp || !newPassword) {
				return h
					.response({ message: "Email, OTP, and new password are required" })
					.code(400);
			}

			// Find user by email
			const userSnapshot = await firebase
				.firestore()
				.collection("users")
				.where("email", "==", email)
				.get();

			if (userSnapshot.empty) {
				return h.response({ message: "User not found" }).code(404);
			}

			const userDoc = userSnapshot.docs[0];

			// Check if OTP has expired
			const currentTime = new Date().getTime();
			const otpExpiresAt = userDoc.data().otpExpiresAt;

			if (!otpExpiresAt || currentTime > otpExpiresAt) {
				return h.response({ message: "OTP has expired" }).code(400);
			}

			// Verify OTP
			const isOtpValid = await authService.verifyOtp(otp, userDoc);

			if (!isOtpValid) {
				return h.response({ message: "Invalid OTP" }).code(400);
			}

			// Hash new password
			const salt = await bcrypt.genSalt(10);
			const hashedPassword = await bcrypt.hash(newPassword, salt);

			// Update user document with new password
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
	 * Handles username update requests.
	 * @param {Object} request - The request object.
	 * @param {Object} h - The response toolkit.
	 * @returns {Promise<Object>} - The response object with a success message.
	 */
	editUsernameHandler: async (request, h) => {
		try {
			const { userId } = request.params;
			const { newUsername } = request.payload;

			// Validate input
			if (!userId || !newUsername) {
				return h
					.response({ message: "User ID and new username are required" })
					.code(400);
			}

			// Update user document with new username
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
	 * Handles password update requests.
	 * @param {Object} request - The request object.
	 * @param {Object} h - The response toolkit.
	 * @returns {Promise<Object>} - The response object with a success message.
	 */
	changePasswordHandler: async (request, h) => {
		try {
			const { userId } = request.params;
			const { oldPassword, newPassword } = request.payload;

			// Validate input
			if (!userId || !oldPassword || !newPassword) {
				return h
					.response({
						message: "User ID, old password, and new password are required",
					})
					.code(400);
			}

			// Find user by ID
			const userDoc = await firebase
				.firestore()
				.collection("users")
				.doc(userId)
				.get();

			if (!userDoc.exists) {
				return h.response({ message: "User not found" }).code(404);
			}

			// Compare old password
			const storedPassword = userDoc.data().password;
			const isMatch = await bcrypt.compare(oldPassword, storedPassword);

			if (!isMatch) {
				return h.response({ message: "Invalid old password" }).code(401);
			}

			// Hash new password
			const hashedNewPassword = await bcrypt.hash(newPassword, 10);

			// Update user document with new password
			await userDoc.ref.update({ password: hashedNewPassword });

			return h.response({ message: "Password successfully changed" }).code(200);
		} catch (error) {
			console.error("Error changing password:", error);
			return h.response({ message: "Internal server error" }).code(500);
		}
	},

	/**
	 * Handles user logout.
	 * @param {Object} request - The request object.
	 * @param {Object} h - The response toolkit.
	 * @returns {Promise<Object>} - The response object with a success message.
	 */
	logoutHandler: async (request, h) => {
		return h.response({ message: "Logged out successfully" }).code(200);
	},
};

module.exports = authService;
