const ErrorResponse = require("../utils/errorResponse");
const asyncHandler = require("../middlewares/async");
const User = require("../models/User");
const bcrypt = require("bcrypt");
const nodemailer = require("nodemailer");
const jwt = require("jsonwebtoken");
const web3 = require("../utils/Web3Provider");

// @desc      Get all users
// @route     GET /api/users
// @access    Admin
exports.getUsers = asyncHandler(async (req, res, next) => {
  const users = await User.find();
  res.status(200).json({
    success: true,
    count: users.length,
    data: users,
  });
});

// @desc      Get single user
// @route     GET /api/users/:id
// @access    Private
exports.getLoggedUser = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const user = await User.findById(id);
  if (!user) return next(new ErrorResponse(404, "User not found"));
  res.status(200).json({
    success: true,
    data: user,
  });
});

// @desc      Get single user/Login user
// @route     GET /api/users/:email/:password
// @access    Private
exports.loginUser = asyncHandler(async (req, res, next) => {
  const { email, password } = req.body;
  if (!email || !password)
    return next(new ErrorResponse(403, "Fields missing"));
  const user = await User.findOne({ email });
  if (!user) return next(new ErrorResponse(404, "User not found"));
  await bcrypt.compare(password, user.password, (err, same) => {
    if (err) return next(new ErrorResponse(500, "Failed to compare password"));
    if (same) {
      const token = jwt.sign({ user }, process.env.JWT_SECRET, {
        expiresIn: process.env.JWT_EXPIRES_IN,
      });
      console.log(user);
      res.status(200).json({ token });
    } else {
      return next(new ErrorResponse(401, "Passwords do not match"));
    }
  });
});

// @desc      Authorize Token
// @route     GET api/auth/
// @access    Private
exports.authorizeToken = asyncHandler(async (req, res, next) => {
  try {
    const token = String(req?.headers?.authorization?.replace("Bearer ", ""));
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findOne({ email: decoded.user.email });
    res.status(200).json({
      authenticated: true,
      user: {
        name: user.name,
        email: user.email,
        wallet: user.walletAddress,
        privateKey: user.privateKey,
      },
    });
    next();
  } catch (err) {
    res.status(401).json({ message: "Invalid Token" });
  }
});

// @desc      Create user
// @route     POST api/signup
// @access    Private
exports.registerUser = asyncHandler(async (req, res, next) => {
  let data = req.body;
  const { name, email, password } = data;
  if (!name || !email || !password)
    return next(new ErrorResponse(400, "Fields missing"));
  const wallet = web3.eth.accounts.create();
  console.log(wallet);
  data = Object.assign(req.body, {
    walletAddress: wallet.address,
    privateKey: wallet.privateKey,
  });

  // Add check for existing users
  const user = await User.findOne({ email });
  if (user) return next(new ErrorResponse(400, "User already exists"));

  const newUser = await User.create(data);
  const token = jwt.sign({ user: newUser }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN,
  });

  res.status(201).json({ token });
});

// @desc      Send Tokens
// @route     POST api/sendTokens
// @access    Private
exports.sendTokens = asyncHandler(async (req, res, next) => {
  let data = req.body;
  const txData = {
    from: data.snd_address,
    to: data.rcv_address,
    value: data.value,
  };
  web3.eth.accounts
    .signTransaction(txData, data.snd_key)
    .then((signedTx) => {
      const signedTransaction = signedTx.rawTransaction;
      // Proceed to broadcast the signedTransaction
      console.log(signedTx);
      // web3.eth
      //   .sendSignedTransaction(signedTransaction)
      //   .on("transactionHash", (txHash) => {
      //     console.log("Transaction Hash:", txHash);
      //     web3.eth
      //       .getTransactionReceipt(txHash)
      //       .then((receipt) => {
      //         if (receipt && receipt.blockNumber) {
      //           console.log("Transaction confirmed!");
      //           // Proceed to update user balances
      //         } else {
      //           console.log(
      //             "Transaction not yet confirmed. Retry after some time."
      //           );
      //           // Implement retry logic or wait for confirmation to proceed
      //         }
      //       })
      //       .catch((error) => {
      //         console.error("Failed to get transaction receipt:", error);
      //       });
      //   })
      //   .on("error", (error) => {
      //     console.error("Failed to broadcast transaction:", error);
      //   });
    })
    .catch((error) => {
      console.error("Failed to sign transaction:", error);
    });

  res.status(201).json({
    success: true,
    data: data,
  });
});

// @desc      Create user
// @route     POST /api/users/verify
// @access    Private
exports.verifyUser = asyncHandler(async (req, res, next) => {
  const user = await User.find({ email: req.body.email });
  if (user.length > 0) {
    res.status(403).json({
      error: true,
      msg: "User already exists",
    });
    // return next(new ErrorResponse(403, 'User Already Registered'));
  } else {
    var transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.MAIL_SENDER,
        pass: process.env.MAIL_PASSWORD,
      },
    });
    var OTP = Math.floor(100000 + Math.random() * 100001);
    var mailOptions = {
      from: process.env.MAIL_SENDER,
      to: req.body.email,
      subject: "Verify User",
      text: `Hello, ${req.body.name}! Your OTP is ${OTP}`,
    };

    transporter.sendMail(mailOptions, function (error, info) {
      if (error) {
        res.status(404).json({
          error,
        });
      } else {
        res.status(200).json({
          OTP,
        });
      }
    });
  }
});

// @desc      Change Password
// @route     PUT /api/users/changePassword/:id
// @access    Private
exports.changePassword = asyncHandler(async (req, res, next) => {
  const user = await User.findById(req.params.id);
  const salt = await bcrypt.genSalt(10);
  const password = await bcrypt.hash(req.body.new, salt);
  await bcrypt.compare(req.body.old, user.password, async (err, same) => {
    if (err) return next(new ErrorResponse(500, "Failed to compare password"));
    if (same) {
      const newUser = await User.findByIdAndUpdate(
        user.id,
        {
          password: password,
        },
        { returnOriginal: false }
      );
      console.log(user.password, newUser.password);
    } else {
      res.status(404).json({
        error: true,
        msg: "Wrong password entered",
      });
    }
  });
  res.status(200).json({
    success: true,
    data: user,
  });
});

// @desc      Update user
// @route     PUT /api/users/:id
// @access    Private/Admin
exports.updateUser = asyncHandler(async (req, res, next) => {
  const user = await User.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
  });

  res.status(200).json({
    success: true,
    data: user,
  });
});

// @desc      Delete user
// @route     DELETE /api/users/:id
// @access    Private/Admin
exports.deleteUser = asyncHandler(async (req, res, next) => {
  await User.findByIdAndDelete(req.params.id);

  res.status(200).json({
    success: true,
  });
});
