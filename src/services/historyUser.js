const firebase = require("../server/firebase");

const fetchUserHistory = async (request, h) => {
  const userId = request.params.userId;

  try {
    const userRef = firebase.firestore().collection("users").doc(userId);
    const analysisResultsSnapshot = await userRef.collection("analysisResults").get();

    const history = [];
    analysisResultsSnapshot.forEach((doc) => {
      history.push({ id: doc.id, ...doc.data() });
    });

    return h.response(history).code(200);
  } catch (error) {
    console.error("Error fetching analysis history:", error);
    return h.response({ message: "Internal server error" }).code(500);
  }
};

module.exports = { fetchUserHistory };
