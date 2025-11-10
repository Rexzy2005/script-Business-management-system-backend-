const mongoose = require('mongoose');

const clientSchema = new mongoose.Schema({
  // User reference
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User reference is required'],
    index: true
  },

  // Basic Information
  name: {
    type: String,
    required: [true, 'Client name is required'],
    trim: true,
    maxlength: [200, 'Name cannot exceed 200 characters']
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    lowercase: true,
    trim: true,
    match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email']
  },
  phone: {
    type: String,
    required: [true, 'Phone number is required'],
    trim: true
  },
  alternatePhone: {
    type: String,
    trim: true
  },

  // Address Information
  address: {
    street: {
      type: String,
      trim: true
    },
    city: {
      type: String,
      required: [true, 'City is required'],
      trim: true
    },
    state: {
      type: String,
      trim: true
    },
    country: {
      type: String,
      default: 'Nigeria',
      trim: true
    },
    postalCode: {
      type: String,
      trim: true
    }
  },

  // Contact Person (for business clients)
  contactPerson: {
    name: {
      type: String,
      trim: true
    },
    title: {
      type: String,
      trim: true
    },
    email: {
      type: String,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email']
    },
    phone: {
      type: String,
      trim: true
    }
  },

  // Client Type & Details
  clientType: {
    type: String,
    enum: ['individual', 'business'],
    default: 'individual'
  },
  businessName: {
    type: String,
    trim: true
  },
  taxId: {
    type: String,
    trim: true
  },
  website: {
    type: String,
    trim: true
  },

  // Financial Information
  creditLimit: {
    type: Number,
    default: 0,
    min: [0, 'Credit limit cannot be negative']
  },
  currentBalance: {
    type: Number,
    default: 0
  },
  totalPaid: {
    type: Number,
    default: 0,
    min: [0, 'Total paid cannot be negative']
  },
  totalOwed: {
    type: Number,
    default: 0,
    min: [0, 'Total owed cannot be negative']
  },

  // Payment Terms
  paymentTerms: {
    type: String,
    enum: ['immediate', 'net_7', 'net_15', 'net_30', 'net_45', 'net_60', 'custom'],
    default: 'net_30'
  },
  customPaymentTerms: {
    type: Number, // Days
    min: [1, 'Payment terms must be at least 1 day']
  },
  preferredPaymentMethod: {
    type: String,
    enum: ['cash', 'bank_transfer', 'card', 'cheque', 'mobile_money', 'other']
  },

  // Status & Tracking
  status: {
    type: String,
    enum: ['active', 'inactive', 'blacklisted'],
    default: 'active'
  },
  rating: {
    type: Number,
    min: [1, 'Rating must be between 1 and 5'],
    max: [5, 'Rating must be between 1 and 5']
  },
  tags: [{
    type: String,
    trim: true
  }],
  notes: {
    type: String,
    maxlength: [1000, 'Notes cannot exceed 1000 characters']
  },

  // Statistics (auto-calculated)
  stats: {
    totalInvoices: {
      type: Number,
      default: 0
    },
    paidInvoices: {
      type: Number,
      default: 0
    },
    overdueInvoices: {
      type: Number,
      default: 0
    },
    lastInvoiceDate: Date,
    lastPaymentDate: Date,
    averagePaymentTime: Number // Days
  },

  // Custom Fields
  customFields: {
    type: Map,
    of: String
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Compound indexes
clientSchema.index({ user: 1, email: 1 });
clientSchema.index({ user: 1, status: 1 });
clientSchema.index({ user: 1, name: 1 });
clientSchema.index({ user: 1, 'address.city': 1 });

// Text index for search
clientSchema.index({
  name: 'text',
  email: 'text',
  'contactPerson.name': 'text',
  businessName: 'text'
});

// Virtual for full address
clientSchema.virtual('fullAddress').get(function() {
  const parts = [
    this.address.street,
    this.address.city,
    this.address.state,
    this.address.country,
    this.address.postalCode
  ].filter(Boolean);
  return parts.join(', ');
});

// Virtual for payment term days
clientSchema.virtual('paymentTermDays').get(function() {
  if (this.paymentTerms === 'custom') {
    return this.customPaymentTerms || 30;
  }
  const terms = {
    immediate: 0,
    net_7: 7,
    net_15: 15,
    net_30: 30,
    net_45: 45,
    net_60: 60
  };
  return terms[this.paymentTerms] || 30;
});

// Virtual for outstanding balance
clientSchema.virtual('outstandingBalance').get(function() {
  return this.totalOwed - this.totalPaid;
});

// Method to check if client is within credit limit
clientSchema.methods.isWithinCreditLimit = function(additionalAmount = 0) {
  const totalOwing = this.outstandingBalance + additionalAmount;
  return this.creditLimit === 0 || totalOwing <= this.creditLimit;
};

// Method to update financial stats
clientSchema.methods.updateFinancials = async function(invoiceAmount, paymentAmount = 0) {
  this.totalOwed += invoiceAmount;
  this.totalPaid += paymentAmount;
  this.currentBalance = this.totalOwed - this.totalPaid;
  return this.save();
};

// Static method to find clients by user with filters
clientSchema.statics.findByUser = function(userId, filters = {}) {
  const query = { user: userId, ...filters };
  return this.find(query).sort({ name: 1 });
};

// Static method to get active clients
clientSchema.statics.getActiveClients = function(userId) {
  return this.find({ user: userId, status: 'active' }).sort({ name: 1 });
};

// Static method to search clients
clientSchema.statics.searchClients = function(userId, searchTerm) {
  return this.find({
    user: userId,
    $text: { $search: searchTerm }
  }, {
    score: { $meta: 'textScore' }
  }).sort({ score: { $meta: 'textScore' } });
};

const Client = mongoose.model('Client', clientSchema);

module.exports = Client;