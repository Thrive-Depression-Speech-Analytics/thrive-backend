const Hapi = require("@hapi/hapi");
const Jwt = require("@hapi/jwt");
const authRoutes = require("./routes");
const firebase = require("./firebase");

require("dotenv").config();

const init = async () => {
	const server = Hapi.server({
		port: process.env.PORT || 8080, // Use the port Cloud Run provides
		host: "0.0.0.0", // Listen on all interfaces in Cloud Run
		routes: {
			cors: {
				origin: ["*"], //  Permissive for now, restrict in production
				headers: ["Authorization", "Content-Type"],
				credentials: true,
			},
			validate: {
				failAction: async (request, h, err) => {
					if (err) {
						throw err;
					}
				},
			},
		},
	});

	await server.register(Jwt);

	server.auth.strategy("jwt", "jwt", {
		keys: process.env.JWT_SECRET,
		verify: {
			aud: false,
			iss: false,
			sub: false,
			nbf: true,
			exp: true,
			maxAgeSec: 14400,
			timeSkewSec: 15,
		},
		validate: async (artifacts, request, h) => {
			try {
				const { userId } = artifacts.decoded.payload; // Extract userId

				const userRef = firebase.firestore().collection("users").doc(userId); // Use userId
				const userDoc = await userRef.get();

				if (!userDoc.exists) {
					return { isValid: false };
				}

				// It's usually recommended to attach the userId to credentials
				return {
					isValid: true,
					credentials: { userId },
				};
			} catch (error) {
				return { isValid: false };
			}
		},
	});
	server.auth.default("jwt");

	server.route(authRoutes);

	await server.start();
	console.log("Server running on %s", server.info.uri);
};

process.on("unhandledRejection", err => {
	console.log(err);
	process.exit(1);
});

init();
