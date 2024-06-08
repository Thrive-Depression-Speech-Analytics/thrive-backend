const authService = require("../auth/authService");
const { fetchUserHistory } = require("../services/historyUser");
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
    path: "/forgot-password",
    options: { auth: false },
    handler: authService.forgotPasswordHandler,
  },
  {
    method: "POST",
    path: "/reset-password",
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
  },
  {
    method: "POST",
    path: "/edit-username/{userId}",
    options: { auth: "jwt" },
    handler: authService.editUsernameHandler,
  },
  {
    method: "POST",
    path: "/change-password/{userId}",
    options: { auth: "jwt" },
    handler: authService.editPasswordHandler,
  },
  {
    method: "POST",
    path: "/logout",
    options: { auth: "jwt" },
    handler: authService.logoutHandler,
  },
];
module.exports = routes;
