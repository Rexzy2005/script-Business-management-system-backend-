const Inventory = require("../models/Inventory");

/**
 * @route   POST /api/inventory
 * @desc    Create a new inventory item
 * @access  Private
 */
const createInventoryItem = async (req, res) => {
  try {
    const itemData = {
      ...req.body,
      user: req.userId,
    };

    // Check if SKU already exists for this user
    const existingItem = await Inventory.findOne({
      user: req.userId,
      sku: req.body.sku,
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

    res.status(200).json({
      success: true,
      data: {
        value,
        lowStockCount,
        outOfStockCount,
        byCategory: categoryBreakdown,
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
};
