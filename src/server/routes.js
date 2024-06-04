const authService = require("../auth/authService");
const { fetchUserHistory } = require("../services/historyUser");
const audioControllers = require("../services/audioHandler");

const routes = [
	{
		method: "POST",
		path: "/register",
		options: { auth: false },
		handler: async (request, h) => {
			const { email, password } = request.payload;
			return authService.createUser(email, password);
		},
	},

	{
		method: "POST",
		path: "/login",
		options: { auth: false },
		handler: async (request, h) => {
			const { email, password } = request.payload;
			return authService.signInWithEmailAndPassword(email, password);
		},
	},
	{
		method: "POST",
		path: "/forgot-password",
		options: { auth: false },
		handler: async (request, h) => {
			const { email } = request.payload;
			return authService.forgotPassword(email);
		},
	},
	{
		method: "POST",
		path: "/reset-password",
		options: { auth: false },
		handler: async (request, h) => {
			const { email, otp, newPassword } = request.payload;
			return authService.resetPassword(email, otp, newPassword);
		},
	},

	{
		method: "POST",
		path: "/analyze",
		options: {
			auth: "jwt",
			payload: {
				output: "stream",
				parse: true,
				allow: "multipart/form-data",
				maxBytes: 10 * 1024 * 1024,
			},
		},
		handler: audioControllers.analyzeHandler,
	},

	{
		method: "GET",
		path: "/history/{userId}",
		options: { auth: "jwt" },
		handler: fetchUserHistory,
	},
];
module.exports = routes;