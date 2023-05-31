const express = require("express");
const {
  getUsers,
  loginUser,
  registerUser,
  updateUser,
  deleteUser,
  getLoggedUser,
  verifyUser,
  changePassword,
  sendTokens,
  authorizeToken,
} = require("../controllers/userController");
const auth = require("../middlewares/auth");

const router = express.Router({ mergeParams: true });

router.route("/").get(getUsers);
router.route("/verify").post(verifyUser);

router.route("/login").post(loginUser);
router.route("/signup").post(registerUser);
router.route("/auth").get(authorizeToken);
router.route("/:id").get(getLoggedUser).put(updateUser).delete(deleteUser);
router.route("/changePassword/:id").put(changePassword);

router.route("/sendTokens").post(sendTokens);

module.exports = router;
