// models/index.js
// Central export file for all models

const User = require("./User");
const Client = require("./Client");
const { Invoice, InvoiceItem } = require("./Invoice");
const Inventory = require("./Inventory");
const Payment = require("./Payment");
const Subscription = require("./Subscription");

module.exports = {
  User,
  Client,
  Invoice,
  InvoiceItem,
  Inventory,
  Payment,
  Subscription,
};
