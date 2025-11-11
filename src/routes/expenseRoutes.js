const express = require("express");
const router = express.Router();
const { authenticate } = require("../middlewares/authMiddleware");
const expenseController = require("../controllers/expenseController");

router.post("/", authenticate, expenseController.createExpense);
router.get("/", authenticate, expenseController.getExpenses);
router.delete("/:id", authenticate, expenseController.deleteExpense);

module.exports = router;
