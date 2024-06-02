const authService = require("../auth/authService");
const { fetchUserHistory } = require("../services/HistoryUser");
const audioControllers = require("../services/audioHandler");

const routes = [
  {
    method: "POST",
    path: "/register",
    options: { auth: false },
    handler: authService.signupHandler,
  },

  {
    method: "POST",
    path: "/login",
    options: { auth: false },
    handler: authService.loginHandler,
  },

  {
    method: "POST",
    path:"/forgot-password",
    options: { auth: false },
    handler: authService.forgotPasswordHandler,
  },
  {
    method: "POST",
    path:"/reset-password",
    options: { auth: false },
    handler: authService.resetPasswordHandler,
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
    //   async (request, h) => {
    //     const userId = request.params.userId;

    //     try {
    //       const userRef = firebase.firestore().collection("users").doc(userId);
    //       const analysisResultsSnapshot = await userRef.collection("analysisResults").get();

    //       const history = [];
    //       analysisResultsSnapshot.forEach((doc) => {
    //         history.push({ id: doc.id, ...doc.data() });
    //       });

    //       return h.response(history).code(200);
    //     } catch (error) {
    //       console.error("Error fetching analysis history:", error);
    //       return h.response({ message: "Internal server error" }).code(500);
    //     }
    //   },
  },
];
module.exports = routes;
