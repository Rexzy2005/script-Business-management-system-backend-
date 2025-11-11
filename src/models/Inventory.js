const mongoose = require("mongoose");

const inventorySchema = new mongoose.Schema(
  {
    // User reference
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "User reference is required"],
      index: true,
    },

    // Product Identification
    sku: {
      type: String,
      required: [true, "SKU is required"],
      trim: true,
      uppercase: true,
    },
    barcode: {
      type: String,
      trim: true,
      sparse: true, // Allows multiple null values
    },
    name: {
      type: String,
      required: [true, "Product name is required"],
      trim: true,
      maxlength: [200, "Name cannot exceed 200 characters"],
    },
    description: {
      type: String,
      trim: true,
      maxlength: [1000, "Description cannot exceed 1000 characters"],
    },

    // Categorization
    category: {
      type: String,
      required: [true, "Category is required"],
      trim: true,
      lowercase: true,
    },
    subCategory: {
      type: String,
      trim: true,
      lowercase: true,
    },
    brand: {
      type: String,
      trim: true,
    },
    tags: [
      {
        type: String,
        trim: true,
        lowercase: true,
      },
    ],

    // Inventory Tracking
    quantity: {
      type: Number,
      required: [true, "Quantity is required"],
      min: [0, "Quantity cannot be negative"],
      default: 0,
    },
    unit: {
      type: String,
      required: [true, "Unit is required"],
      default: "unit",
      lowercase: true,
      trim: true,
    },
    reorderPoint: {
      type: Number,
      required: [true, "Reorder point is required"],
      min: [0, "Reorder point cannot be negative"],
      default: 10,
    },
    reorderQuantity: {
      type: Number,
      min: [1, "Reorder quantity must be at least 1"],
      default: 50,
    },
    maxStock: {
      type: Number,
      min: [0, "Max stock cannot be negative"],
    },

    // Pricing
    unitCost: {
      type: Number,
      required: [true, "Unit cost is required"],
      min: [0, "Unit cost cannot be negative"],
    },
    retailPrice: {
      type: Number,
      required: [true, "Retail price is required"],
      min: [0, "Retail price cannot be negative"],
    },
    wholesalePrice: {
      type: Number,
      min: [0, "Wholesale price cannot be negative"],
    },
    discountPrice: {
      type: Number,
      min: [0, "Discount price cannot be negative"],
    },
    taxRate: {
      type: Number,
      min: [0, "Tax rate cannot be negative"],
      max: [100, "Tax rate cannot exceed 100%"],
      default: 0,
    },

    // Supplier Information
    supplier: {
      name: {
        type: String,
        trim: true,
      },
      contactPerson: {
        type: String,
        trim: true,
      },
      email: {
        type: String,
        lowercase: true,
        trim: true,
        match: [/^\S+@\S+\.\S+$/, "Please provide a valid email"],
      },
      phone: {
        type: String,
        trim: true,
      },
      address: String,
      leadTime: {
        type: Number, // Days
        min: [0, "Lead time cannot be negative"],
      },
    },

    // Product Specifications
    specifications: {
      weight: Number,
      weightUnit: {
        type: String,
        enum: ["kg", "g", "lb", "oz"],
      },
      dimensions: {
        length: Number,
        width: Number,
        height: Number,
        unit: {
          type: String,
          enum: ["cm", "m", "in", "ft"],
        },
      },
      color: String,
      size: String,
      material: String,
    },

    // Status & Tracking
    status: {
      type: String,
      enum: ["active", "inactive", "discontinued", "out_of_stock"],
      default: "active",
      index: true,
    },
    lowStockAlert: {
      type: Boolean,
      default: true,
    },
    trackInventory: {
      type: Boolean,
      default: true,
    },

    // Images
    images: [
      {
        url: {
          type: String,
          required: true,
        },
        isPrimary: {
          type: Boolean,
          default: false,
        },
        altText: String,
      },
    ],

    // Warehouse/Location
    location: {
      warehouse: String,
      aisle: String,
      shelf: String,
      bin: String,
    },

    // Stock History (last 10 movements)
    stockHistory: [
      {
        date: {
          type: Date,
          default: Date.now,
        },
        type: {
          type: String,
          enum: [
            "purchase",
            "sale",
            "return",
            "adjustment",
            "damaged",
            "transfer",
            // allow manual adjustments recorded by API
            "manual",
          ],
          required: true,
        },
        quantity: {
          type: Number,
          required: true,
        },
        previousQuantity: Number,
        newQuantity: Number,
        reference: String, // Invoice ID, PO number, etc.
        notes: String,
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
      },
    ],

    // Sales Statistics
    stats: {
      totalSold: {
        type: Number,
        default: 0,
      },
      totalRevenue: {
        type: Number,
        default: 0,
      },
      averageSalePrice: Number,
      lastSoldDate: Date,
      lastRestockedDate: Date,
    },

    // Custom Fields
    customFields: {
      type: Map,
      of: String,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Compound indexes
inventorySchema.index({ user: 1, sku: 1 }, { unique: true });
inventorySchema.index({ user: 1, barcode: 1 }, { sparse: true });
inventorySchema.index({ user: 1, category: 1 });
inventorySchema.index({ user: 1, status: 1 });
inventorySchema.index({ user: 1, quantity: 1 });

// Text index for search
inventorySchema.index({
  name: "text",
  description: "text",
  sku: "text",
  barcode: "text",
  category: "text",
  brand: "text",
});

// Virtual for stock value
inventorySchema.virtual("stockValue").get(function () {
  return this.quantity * this.unitCost;
});

// Virtual for retail value
inventorySchema.virtual("retailValue").get(function () {
  return this.quantity * this.retailPrice;
});

// Virtual for profit margin
inventorySchema.virtual("profitMargin").get(function () {
  if (this.unitCost === 0) return 0;
  return ((this.retailPrice - this.unitCost) / this.unitCost) * 100;
});

// Virtual for is low stock
inventorySchema.virtual("isLowStock").get(function () {
  return this.trackInventory && this.quantity <= this.reorderPoint;
});

// Virtual for is out of stock
inventorySchema.virtual("isOutOfStock").get(function () {
  return this.trackInventory && this.quantity === 0;
});

// Virtual for primary image
inventorySchema.virtual("primaryImage").get(function () {
  const primary = this.images.find((img) => img.isPrimary);
  return primary
    ? primary.url
    : this.images.length > 0
    ? this.images[0].url
    : null;
});

// Virtual alias: qty -> quantity (frontend expects `qty`)
inventorySchema.virtual("qty").get(function () {
  return this.quantity;
});

// Virtual alias: value -> retailValue (frontend expects `value`)
inventorySchema.virtual("value").get(function () {
  return this.retailValue;
});

// Virtual alias: unitType -> unit
inventorySchema.virtual("unitType").get(function () {
  return this.unit;
});

// Virtual alias: pricePerPiece -> retailPrice
inventorySchema.virtual("pricePerPiece").get(function () {
  return this.retailPrice;
});

// Virtual alias: bulkPrice -> wholesalePrice
inventorySchema.virtual("bulkPrice").get(function () {
  return this.wholesalePrice || this.discountPrice || 0;
});

// Pre-save middleware to update status based on quantity
inventorySchema.pre("save", function (next) {
  if (this.trackInventory) {
    if (this.quantity === 0) {
      this.status = "out_of_stock";
    } else if (this.status === "out_of_stock" && this.quantity > 0) {
      this.status = "active";
    }
  }

  // Limit stock history to last 10 entries
  if (this.stockHistory.length > 10) {
    this.stockHistory = this.stockHistory.slice(-10);
  }

  next();
});

// Method to add stock
inventorySchema.methods.addStock = function (
  quantity,
  type = "purchase",
  reference = "",
  notes = "",
  userId = null
) {
  const previousQuantity = this.quantity;
  this.quantity += quantity;

  this.stockHistory.push({
    type,
    quantity,
    previousQuantity,
    newQuantity: this.quantity,
    reference,
    notes,
    user: userId,
  });

  if (type === "purchase") {
    this.stats.lastRestockedDate = new Date();
  }

  return this.save();
};

// Method to reduce stock
inventorySchema.methods.reduceStock = function (
  quantity,
  type = "sale",
  reference = "",
  notes = "",
  userId = null
) {
  if (quantity > this.quantity) {
    throw new Error("Insufficient stock");
  }

  const previousQuantity = this.quantity;
  this.quantity -= quantity;

  this.stockHistory.push({
    type,
    quantity: -quantity,
    previousQuantity,
    newQuantity: this.quantity,
    reference,
    notes,
    user: userId,
  });

  if (type === "sale") {
    this.stats.totalSold += quantity;
    this.stats.lastSoldDate = new Date();
  }

  return this.save();
};

// Method to adjust stock (for corrections)
inventorySchema.methods.adjustStock = function (
  newQuantity,
  notes = "",
  userId = null
) {
  const previousQuantity = this.quantity;
  const difference = newQuantity - this.quantity;

  this.quantity = newQuantity;

  this.stockHistory.push({
    type: "adjustment",
    quantity: difference,
    previousQuantity,
    newQuantity,
    notes,
    user: userId,
  });

  return this.save();
};

// Method to check if reorder needed
inventorySchema.methods.needsReorder = function () {
  return (
    this.trackInventory &&
    this.lowStockAlert &&
    this.quantity <= this.reorderPoint &&
    this.status !== "discontinued"
  );
};

// Static method to get low stock items
inventorySchema.statics.getLowStockItems = function (userId) {
  return this.find({
    user: userId,
    trackInventory: true,
    lowStockAlert: true,
    $expr: { $lte: ["$quantity", "$reorderPoint"] },
    status: { $ne: "discontinued" },
  }).sort({ quantity: 1 });
};

// Static method to get items needing reorder
inventorySchema.statics.getItemsToReorder = function (userId) {
  return this.getLowStockItems(userId).then((items) => {
    return items.map((item) => ({
      id: item._id,
      name: item.name,
      sku: item.sku,
      currentQuantity: item.quantity,
      reorderQuantity: item.reorderQuantity,
      supplier: item.supplier.name,
      estimatedCost: item.unitCost * item.reorderQuantity,
    }));
  });
};

// Static method to calculate total inventory value
inventorySchema.statics.getTotalInventoryValue = async function (userId) {
  // Ensure we pass an ObjectId when userId is a string. Some mongoose versions
  // require `new mongoose.Types.ObjectId(...)` instead of calling as a function.
  const matchUser =
    typeof userId === "string" ? new mongoose.Types.ObjectId(userId) : userId;

  const result = await this.aggregate([
    { $match: { user: matchUser, status: "active" } },
    {
      $group: {
        _id: null,
        totalCostValue: { $sum: { $multiply: ["$quantity", "$unitCost"] } },
        totalRetailValue: {
          $sum: { $multiply: ["$quantity", "$retailPrice"] },
        },
        totalItems: { $sum: 1 },
        totalQuantity: { $sum: "$quantity" },
      },
    },
  ]);

  return (
    result[0] || {
      totalCostValue: 0,
      totalRetailValue: 0,
      totalItems: 0,
      totalQuantity: 0,
    }
  );
};

const Inventory = mongoose.model("Inventory", inventorySchema);

module.exports = Inventory;
