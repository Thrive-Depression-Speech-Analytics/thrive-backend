const Boom = require("@hapi/boom");
const firebase = require("../server/firebase");

/**
 * @function fetchUserHistory
 * @description Fetches the analysis history for a given user.
 * @param {object} request - The Hapi request object.
 * @param {object} h - The Hapi response toolkit.
 * @returns {Promise<object>} - A Promise resolving with the history data or an error.
 */
const fetchUserHistory = async (request, h) => {
	const userId = request.params.userId;

	try {
		const userRef = firebase.firestore().collection("users").doc(userId);
		const analysisResultsSnapshot = await userRef
			.collection("analysisResults")
			.orderBy("timestamp", "desc")
			.get(); 

		const history = analysisResultsSnapshot.docs.map(doc => ({
			id: doc.id,
			...doc.data(),
		}));

		return h.response(history).code(200);
	} catch (error) {
		console.error("Error fetching analysis history:", error);
		throw Boom.badImplementation("Failed to fetch analysis history"); 
	}
};

module.exports = { fetchUserHistory };
