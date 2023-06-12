const mongoose = require("mongoose");

const TransactionSchema = mongoose.Schema({
  txHash: {
    type: String,
  },
  from: {
    type: String,
  },
  to: {
    type: String,
  },
  value: {
    type: Number,
  },
});

module.exports = new mongoose.model("Transactions", TransactionSchema);
