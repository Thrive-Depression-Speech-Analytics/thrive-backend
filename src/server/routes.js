const Joi = require("joi"); // For input validation
const authService = require("../auth/authService");
const { fetchUserHistory } = require("../services/historyUser");
const audioControllers = require("../services/audioHandler");


// --- Input Validation Schemas ---
const signupSchema = Joi.object({
	username: Joi.string().alphanum().min(3).max(30).required(),
	password: Joi.string().min(8).required(),
	email: Joi.string().email().required(),
});

const loginSchema = Joi.object({
	email: Joi.string().email().required(),
	password: Joi.string().required(),
});

const forgotPasswordSchema = Joi.object({
	email: Joi.string().email().required(),
});

const resetPasswordSchema = Joi.object({
	email: Joi.string().email().required(),
	otp: Joi.string().length(6).required(), // Assuming 6-digit OTP
	newPassword: Joi.string().min(8).required(),
});

const editUsernameSchema = Joi.object({
	newUsername: Joi.string().alphanum().min(3).max(30).required(),
});

const changePasswordSchema = Joi.object({
	oldPassword: Joi.string().required(),
	newPassword: Joi.string().min(8).required(),
});



const routes = [
	// --- Authentication Routes ---
	{
		method: "POST",
		path: "/auth/register",
		options: {
			auth: false,
			validate: {
				payload: signupSchema,
			},
		},
		handler: authService.signupHandler,
	},
	{
		method: "POST",
		path: "/auth/login",
		options: {
			auth: false,
			validate: {
				payload: loginSchema,
			},
		},
		handler: authService.loginHandler,
	},
	{
		method: "POST",
		path: "/auth/forgot-password",
		options: {
			auth: false,
			validate: {
				payload: forgotPasswordSchema,
			},
		},
		handler: authService.forgotPasswordHandler,
	},
	{
		method: "POST",
		path: "/auth/reset-password",
		options: {
			auth: false,
			validate: {
				payload: resetPasswordSchema,
			},
		},
		handler: authService.resetPasswordHandler,
	},
	{
		method: "POST",
		path: "/auth/logout",
		options: { auth: "jwt" },
		handler: authService.logoutHandler,
	},

	// --- User Routes ---
	{
		method: "PUT",
		path: "/users/{userId}/username",
		options: {
			auth: "jwt",
			validate: {
				payload: editUsernameSchema,
			},
		},
		handler: authService.editUsernameHandler,
	},
	{
		method: "PUT",
		path: "/users/{userId}/password",
		options: {
			auth: "jwt",
			validate: {
				payload: changePasswordSchema,
			},
		},
		handler: authService.changePasswordHandler,
	},
	{
		method: "GET",
		path: "/users/{userId}/history",
		options: { auth: "jwt" },
		handler: fetchUserHistory,
	},

	// --- Audio Analysis Route ---

	{
		method: "POST",
		path: "/audio/analyze",
		options: {
			auth: "jwt",
			payload: {
				output: "stream", // Handle file uploads as streams
				parse: true,
				allow: "multipart/form-data",
				multipart: true,
				maxBytes: 20 * 1024 * 1024,
			},
			validate: {
				payload: Joi.object({
					audio: Joi.any().meta({ swaggerType: "file" }), 
				}).label("AudioPredictionPayload"),
			},
		},

		handler: audioControllers.analyzeHandler,
	},
];

module.exports = routes;
