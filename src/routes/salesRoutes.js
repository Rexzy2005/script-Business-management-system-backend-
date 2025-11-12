const express = require("express");
const router = express.Router();
const { authenticate } = require("../middlewares/authMiddleware");
const saleController = require("../controllers/saleController");

router.post("/", authenticate, saleController.createSale);
router.get("/", authenticate, saleController.getAllSales);
router.get("/:id", authenticate, saleController.getSaleById);
router.patch("/:id/payment", authenticate, saleController.updateSalePayment);
router.patch("/:id/cancel", authenticate, saleController.cancelSale);

module.exports = router;
