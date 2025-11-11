const Inventory = require("../models/Inventory");
const Sale = require("../models/Sale");

/**
 * @route   POST /api/inventory
 * @desc    Create a new inventory item
 * @access  Private
 */
const createInventoryItem = async (req, res) => {
  try {
    // Normalize frontend payload to backend schema names
    const generateSKU = (name) => {
      if (!name) return `SKU-${Date.now()}`;
      const base = name
        .toString()
        .trim()
        .toUpperCase()
        .replace(/[^A-Z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
      return `${base}-${Math.floor(Math.random() * 9000) + 1000}`;
    };

    const itemData = {
      // map common frontend fields to schema
      sku: req.body.sku || generateSKU(req.body.name || req.body.productName),
      name: req.body.name || req.body.productName || "Unnamed product",
      description: req.body.description || req.body.details || "",
      category: (req.body.category || "").trim() || "uncategorized",
      barcode: req.body.barcode || req.body.upc || undefined,
      unitCost: req.body.costPrice ?? req.body.unitCost ?? 0,
      retailPrice: req.body.unitPrice ?? req.body.retailPrice ?? 0,
      quantity:
        req.body.quantityInStock ?? req.body.qty ?? req.body.quantity ?? 0,
      unit: req.body.unitType || req.body.unit || "unit",
      reorderPoint: req.body.lowStockThreshold ?? req.body.reorderPoint ?? 10,
      reorderQuantity: req.body.reorderQuantity ?? req.body.reorderQty ?? 50,
      supplier: req.body.supplier || {},
      images: req.body.images || [],
      tags: req.body.tags || [],
      user: req.userId,
    };

    // Check if SKU already exists for this user
    const existingItem = await Inventory.findOne({
      user: req.userId,
      sku: itemData.sku,
    });

    if (existingItem) {
      return res.status(400).json({
        success: false,
        message: "Item with this SKU already exists",
      });
    }

    const item = await Inventory.create(itemData);

    res.status(201).json({
      success: true,
      message: "Inventory item created successfully",
      data: { item },
    });
  } catch (error) {
    console.error("Create inventory error:", error);
    res.status(500).json({
      success: false,
      message: "Error creating inventory item",
      error: error.message,
    });
  }
};

/**
 * @route   GET /api/inventory
 * @desc    Get all inventory items with filters
 * @access  Private
 */
const getAllInventory = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      category,
      status,
      lowStock,
      search,
      sortBy = "name",
      sortOrder = "asc",
    } = req.query;

    // Build query
    const query = { user: req.userId };

    if (category) query.category = category.toLowerCase();
    if (status) query.status = status;

    if (lowStock === "true") {
      query.$expr = { $lte: ["$quantity", "$reorderPoint"] };
    }

    if (search) {
      query.$text = { $search: search };
    }

    // Pagination
    const skip = (page - 1) * limit;

    // Sorting
    const sort = {};
    sort[sortBy] = sortOrder === "desc" ? -1 : 1;

    const items = await Inventory.find(query)
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Inventory.countDocuments(query);

    res.status(200).json({
      success: true,
      data: {
        items,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    console.error("Get inventory error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching inventory",
      error: error.message,
    });
  }
};

/**
 * @route   GET /api/inventory/:id
 * @desc    Get inventory item by ID
 * @access  Private
 */
const getInventoryById = async (req, res) => {
  try {
    const item = await Inventory.findOne({
      _id: req.params.id,
      user: req.userId,
    });

    if (!item) {
      return res.status(404).json({
        success: false,
        message: "Inventory item not found",
      });
    }

    res.status(200).json({
      success: true,
      data: { item },
    });
  } catch (error) {
    console.error("Get inventory item error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching inventory item",
      error: error.message,
    });
  }
};

/**
 * @route   PUT /api/inventory/:id
 * @desc    Update inventory item
 * @access  Private
 */
const updateInventoryItem = async (req, res) => {
  try {
    const item = await Inventory.findOne({
      _id: req.params.id,
      user: req.userId,
    });

    if (!item) {
      return res.status(404).json({
        success: false,
        message: "Inventory item not found",
      });
    }

    // Update fields (excluding user and quantity - use separate endpoints)
    const allowedFields = [
      "sku",
      "barcode",
      "name",
      "description",
      "category",
      "subCategory",
      "brand",
      "tags",
      "unit",
      "reorderPoint",
      "reorderQuantity",
      "maxStock",
      "unitCost",
      "retailPrice",
      "wholesalePrice",
      "discountPrice",
      "taxRate",
      "supplier",
      "specifications",
      "status",
      "lowStockAlert",
      "trackInventory",
      "images",
      "location",
      "customFields",
    ];

    allowedFields.forEach((field) => {
      if (req.body[field] !== undefined) {
        item[field] = req.body[field];
      }
    });

    await item.save();

    res.status(200).json({
      success: true,
      message: "Inventory item updated successfully",
      data: { item },
    });
  } catch (error) {
    console.error("Update inventory error:", error);
    res.status(500).json({
      success: false,
      message: "Error updating inventory item",
      error: error.message,
    });
  }
};

/**
 * @route   DELETE /api/inventory/:id
 * @desc    Delete inventory item
 * @access  Private
 */
const deleteInventoryItem = async (req, res) => {
  try {
    const item = await Inventory.findOneAndDelete({
      _id: req.params.id,
      user: req.userId,
    });

    if (!item) {
      return res.status(404).json({
        success: false,
        message: "Inventory item not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Inventory item deleted successfully",
    });
  } catch (error) {
    console.error("Delete inventory error:", error);
    res.status(500).json({
      success: false,
      message: "Error deleting inventory item",
      error: error.message,
    });
  }
};

/**
 * @route   POST /api/inventory/:id/stock/add
 * @desc    Add stock to inventory item
 * @access  Private
 */
const addStock = async (req, res) => {
  try {
    const {
      quantity,
      type = "purchase",
      reference = "",
      notes = "",
    } = req.body;

    if (!quantity || quantity <= 0) {
      return res.status(400).json({
        success: false,
        message: "Valid quantity is required",
      });
    }

    const item = await Inventory.findOne({
      _id: req.params.id,
      user: req.userId,
    });

    if (!item) {
      return res.status(404).json({
        success: false,
        message: "Inventory item not found",
      });
    }

    await item.addStock(quantity, type, reference, notes, req.userId);

    res.status(200).json({
      success: true,
      message: "Stock added successfully",
      data: { item },
    });
  } catch (error) {
    console.error("Add stock error:", error);
    res.status(500).json({
      success: false,
      message: "Error adding stock",
      error: error.message,
    });
  }
};

/**
 * @route   POST /api/inventory/:id/stock/reduce
 * @desc    Reduce stock from inventory item
 * @access  Private
 */
const reduceStock = async (req, res) => {
  try {
    const { quantity, type = "sale", reference = "", notes = "" } = req.body;

    if (!quantity || quantity <= 0) {
      return res.status(400).json({
        success: false,
        message: "Valid quantity is required",
      });
    }

    const item = await Inventory.findOne({
      _id: req.params.id,
      user: req.userId,
    });

    if (!item) {
      return res.status(404).json({
        success: false,
        message: "Inventory item not found",
      });
    }

    await item.reduceStock(quantity, type, reference, notes, req.userId);

    res.status(200).json({
      success: true,
      message: "Stock reduced successfully",
      data: { item },
    });
  } catch (error) {
    console.error("Reduce stock error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Error reducing stock",
      error: error.message,
    });
  }
};

/**
 * @route   POST /api/inventory/:id/stock/adjust
 * @desc    Adjust stock quantity (for corrections)
 * @access  Private
 */
const adjustStock = async (req, res) => {
  try {
    const { quantity, notes = "" } = req.body;

    if (quantity === undefined || quantity < 0) {
      return res.status(400).json({
        success: false,
        message: "Valid quantity is required",
      });
    }

    const item = await Inventory.findOne({
      _id: req.params.id,
      user: req.userId,
    });

    if (!item) {
      return res.status(404).json({
        success: false,
        message: "Inventory item not found",
      });
    }

    await item.adjustStock(quantity, notes, req.userId);

    res.status(200).json({
      success: true,
      message: "Stock adjusted successfully",
      data: { item },
    });
  } catch (error) {
    console.error("Adjust stock error:", error);
    res.status(500).json({
      success: false,
      message: "Error adjusting stock",
      error: error.message,
    });
  }
};

/**
 * @route   PATCH /api/inventory/:id/stock
 * @desc    Update stock by a delta (positive to add, negative to remove)
 * @access  Private
 */
const updateStock = async (req, res) => {
  try {
    const { quantityChange, reason = "" } = req.body;

    if (typeof quantityChange === "undefined" || quantityChange === null) {
      return res.status(400).json({
        success: false,
        message: "quantityChange is required",
      });
    }

    const item = await Inventory.findOne({
      _id: req.params.id,
      user: req.userId,
    });
    if (!item) {
      return res
        .status(404)
        .json({ success: false, message: "Inventory item not found" });
    }

    if (quantityChange > 0) {
      await item.addStock(quantityChange, "manual", null, reason, req.userId);
    } else if (quantityChange < 0) {
      const removeQty = Math.abs(quantityChange);
      // reduceStock will throw if insufficient stock
      await item.reduceStock(removeQty, "manual", null, reason, req.userId);
    }

    res.status(200).json({
      success: true,
      message: "Stock updated successfully",
      data: { item },
    });
  } catch (error) {
    console.error("Update stock error:", error);
    res.status(500).json({
      success: false,
      message: "Error updating stock",
      error: error.message,
    });
  }
};

/**
 * @route   GET /api/inventory/low-stock
 * @desc    Get low stock items
 * @access  Private
 */
const getLowStockItems = async (req, res) => {
  try {
    const items = await Inventory.getLowStockItems(req.userId);

    res.status(200).json({
      success: true,
      data: {
        items,
        count: items.length,
      },
    });
  } catch (error) {
    console.error("Get low stock error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching low stock items",
      error: error.message,
    });
  }
};

/**
 * @route   GET /api/inventory/reorder
 * @desc    Get items that need reordering
 * @access  Private
 */
const getItemsToReorder = async (req, res) => {
  try {
    const items = await Inventory.getItemsToReorder(req.userId);

    res.status(200).json({
      success: true,
      data: {
        items,
        count: items.length,
      },
    });
  } catch (error) {
    console.error("Get reorder items error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching reorder items",
      error: error.message,
    });
  }
};

/**
 * @route   GET /api/inventory/categories
 * @desc    Get all categories
 * @access  Private
 */
const getCategories = async (req, res) => {
  try {
    const categories = await Inventory.distinct("category", {
      user: req.userId,
    });

    res.status(200).json({
      success: true,
      data: { categories },
    });
  } catch (error) {
    console.error("Get categories error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching categories",
      error: error.message,
    });
  }
};

/**
 * @route   GET /api/inventory/stats
 * @desc    Get inventory statistics
 * @access  Private
 */
const getInventoryStats = async (req, res) => {
  try {
    const value = await Inventory.getTotalInventoryValue(req.userId);

    const lowStockCount = await Inventory.countDocuments({
      user: req.userId,
      trackInventory: true,
      lowStockAlert: true,
      $expr: { $lte: ["$quantity", "$reorderPoint"] },
    });

    const outOfStockCount = await Inventory.countDocuments({
      user: req.userId,
      trackInventory: true,
      quantity: 0,
    });

    const categoryBreakdown = await Inventory.aggregate([
      { $match: { user: req.userId } },
      {
        $group: {
          _id: "$category",
          count: { $sum: 1 },
          totalValue: { $sum: { $multiply: ["$quantity", "$unitCost"] } },
        },
      },
      { $sort: { totalValue: -1 } },
    ]);

    // Additional overview fields expected by frontend
    const totalProducts = await Inventory.countDocuments({ user: req.userId });
    const totalQuantityAgg = await Inventory.aggregate([
      { $match: { user: req.userId } },
      { $group: { _id: null, totalQty: { $sum: "$quantity" } } },
    ]);
    const totalQuantity =
      (totalQuantityAgg[0] && totalQuantityAgg[0].totalQty) || 0;

    // Total revenue from sales (all time)
    let totalRevenue = 0;
    try {
      const revAgg = await Sale.aggregate([
        { $match: { user: req.userId } },
        { $group: { _id: null, totalRevenue: { $sum: "$total" } } },
      ]);
      totalRevenue = (revAgg[0] && revAgg[0].totalRevenue) || 0;
    } catch (e) {
      console.warn("Failed to compute total revenue:", e.message);
    }

    // Top selling products by revenue and units (based on Sale.items)
    let topSelling = [];
    try {
      const topAgg = await Sale.aggregate([
        { $match: { user: req.userId } },
        { $unwind: "$items" },
        {
          $group: {
            _id: { sku: "$items.sku", name: "$items.name" },
            totalSold: { $sum: "$items.qty" },
            totalRevenue: { $sum: "$items.lineTotal" },
          },
        },
        { $sort: { totalRevenue: -1 } },
        { $limit: 10 },
      ]);

      topSelling = topAgg.map((t) => ({
        _id: t._id.sku || t._id.name,
        name: t._id.name,
        analytics: { totalRevenue: t.totalRevenue, totalSold: t.totalSold },
      }));
    } catch (e) {
      console.warn("Failed to compute top selling products:", e.message);
    }

    // Monthly sales for last 12 months
    let monthly = [];
    try {
      const now = new Date();
      const start = new Date(now.getFullYear(), now.getMonth() - 11, 1);
      const monthlyAgg = await Sale.aggregate([
        { $match: { user: req.userId, createdAt: { $gte: start } } },
        {
          $group: {
            _id: { $dateToString: { format: "%Y-%m", date: "$createdAt" } },
            sales: { $sum: "$total" },
          },
        },
        { $sort: { _id: 1 } },
      ]);

      // build last 12 months labels
      const months = [];
      for (let i = 11; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, "0");
        months.push(`${y}-${m}`);
      }

      const mapAgg = {};
      for (const it of monthlyAgg) mapAgg[it._id] = Number(it.sales) || 0;

      monthly = months.map((mm) => ({
        month: mm,
        sales: mapAgg[mm] || 0,
        target: 0,
      }));
    } catch (e) {
      console.warn("Failed to compute monthly sales:", e.message);
    }

    res.status(200).json({
      success: true,
      data: {
        overview: {
          totalProducts,
          totalQuantity,
          totalValue:
            (value && (value.totalRetailValue || value.totalCostValue)) || 0,
          lowStockCount,
          outOfStockCount,
          totalRevenue,
        },
        byCategory: categoryBreakdown,
        topSelling,
        monthly,
      },
    });
  } catch (error) {
    console.error("Get inventory stats error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching inventory statistics",
      error: error.message,
    });
  }
};

/**
 * @route   GET /api/inventory/search
 * @desc    Search inventory items
 * @access  Private
 */
const searchInventory = async (req, res) => {
  try {
    const { q } = req.query;

    if (!q) {
      return res.status(400).json({
        success: false,
        message: "Search query is required",
      });
    }

    const items = await Inventory.find(
      {
        user: req.userId,
        $text: { $search: q },
      },
      {
        score: { $meta: "textScore" },
      }
    ).sort({ score: { $meta: "textScore" } });

    res.status(200).json({
      success: true,
      data: { items },
    });
  } catch (error) {
    console.error("Search inventory error:", error);
    res.status(500).json({
      success: false,
      message: "Error searching inventory",
      error: error.message,
    });
  }
};

module.exports = {
  createInventoryItem,
  getAllInventory,
  getInventoryById,
  updateInventoryItem,
  deleteInventoryItem,
  addStock,
  reduceStock,
  adjustStock,
  getLowStockItems,
  getItemsToReorder,
  getCategories,
  getInventoryStats,
  searchInventory,
  updateStock,
};
