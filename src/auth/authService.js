// auth.js

const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { auth } = require("../server/firebase");
const nodemailer = require("nodemailer"); // Add this line

require("dotenv").config();

const authService = {
	// When a user creates an account
	async createUser(email, password) {
		try {
			const hashedPassword = await bcrypt.hash(password, 10);
			const user = await auth.createUser({ email, password: hashedPassword });
			await auth.setCustomUserClaims(user.uid, { hashedPassword });
			return { userId: user.uid };
		} catch (error) {
			console.error(error);
			return { error: "Failed to create user" };
		}
	},

	// When a user logs in
	async signInWithEmailAndPassword(email, password) {
		try {
			const user = await auth.getUserByEmail(email);
			if (!user) {
				return { error: "User not found" };
			}
			const hashedPassword = user.customClaims.hashedPassword;
			if (!hashedPassword) {
				return { error: "Password not found" };
			}
			const isValidPassword = await bcrypt.compare(password, hashedPassword);
			if (!isValidPassword) {
				return { error: "Invalid password" };
			}
			// Login successful, return a token or other authentication credentials
			const token = await authService.generateToken(user.uid);
			return { token };
		} catch (error) {
			console.error(error);
			return { error: "Failed to sign in" };
		}
	},

	async getHashedPasswordFromDatabase(userId) {
		try {
			const user = await auth.getUser(userId);
			if (!user) {
				throw new Error("User not found");
			}
			return user.customClaims.hashedPassword;
		} catch (error) {
			throw new Error("User not found");
		}
	},

	async forgotPassword(email) {
		try {
			const user = await auth.getUserByEmail(email);
			if (!user) {
				return { error: "User not found" };
			}
			const otp = Math.floor(100000 + Math.random() * 900000);
			await auth.setCustomUserClaims(user.uid, {
				otp,
				otpExpiresAt: Date.now() + 300000,
			});

			console.log(process.env)
			// Send OTP to user's email using Nodemailer
			const transporter = nodemailer.createTransport({
				host: "smtp.gmail.com",
				port: 587,
				secure: false, // or 'STARTTLS'
				auth: {
					user: process.env.EMAIL_USER, // Ganti dengan alamat email Anda
					pass: process.env.EMAIL_PASS, // Ganti dengan kata sandi email Anda
				},
			});

			const mailOptions = {
				from: process.env.EMAIL_USER, // Ganti dengan alamat email Anda
				to: email,
				subject: "Kode OTP Anda",
				text: `Kode OTP Anda adalah: ${otp}`,
			};

			await transporter.sendMail(mailOptions);

			return { message: "OTP sent to your email" };
		} catch (error) {
			return { error: error.message };
		}
	},

	async resetPassword(email, otp, newPassword) {
		try {
			const user = await auth.getUserByEmail(email);
			if (!user) {
				throw new Error("User not found");
			}

			const { customClaims } = await auth.getUser(user.uid);
			console.log("Custom claims:", customClaims);

			if (!customClaims.otp) {
				throw new Error("OTP not found in custom claims");
			}

			if (customClaims.otp !== otp) {
				throw new Error("Invalid OTP");
			}

			if (customClaims.otpExpiresAt < Date.now()) {
				throw new Error("OTP has expired");
			}

			const credential = firebase.auth.EmailAuthProvider.credential(
				email,
				newPassword
			);
			await user.reauthenticateWithCredential(credential);
			await user.updatePassword(newPassword);
			await auth.setCustomUserClaims(user.uid, {
				otp: null,
				otpExpiresAt: null,
			});

			return { message: "Password reset successfully" };
		} catch (error) {
			console.error("Error resetting password:", error);
			return { error: error.message };
		}
	},

	async verifyPassword(userId, password) {
		const hashedPassword = await authService.getHashedPasswordFromDatabase(
			userId
		);
		const isValid = await bcrypt.compare(password, hashedPassword);
		return isValid;
	},

	async generateToken(userId) {
		const secretKey = "WADUBFUQUHR!(@*U!)";
		console.log(`Generating token for user ${userId}`);
		const token = jwt.sign({ userId }, secretKey, { expiresIn: "1h" });
		console.log(`Token generated: ${token}`);
		return token;
	},
};

module.exports = authService;
