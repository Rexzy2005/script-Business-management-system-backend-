const Client = require("../models/Client");

/**
 * @route   POST /api/clients
 * @desc    Create a new client
 * @access  Private
 */
const createClient = async (req, res) => {
  try {
    const clientData = {
      ...req.body,
      user: req.userId,
    };

    const client = await Client.create(clientData);

    res.status(201).json({
      success: true,
      message: "Client created successfully",
      data: { client },
    });
  } catch (error) {
    console.error("Create client error:", error);
    res.status(500).json({
      success: false,
      message: "Error creating client",
      error: error.message,
    });
  }
};

/**
 * @route   GET /api/clients
 * @desc    Get all clients for authenticated user
 * @access  Private
 */
const getAllClients = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      status,
      clientType,
      city,
      search,
      sortBy = "name",
      sortOrder = "asc",
    } = req.query;

    // Build query
    const query = { user: req.userId };

    if (status) query.status = status;
    if (clientType) query.clientType = clientType;
    if (city) query["address.city"] = { $regex: city, $options: "i" };

    if (search) {
      query.$text = { $search: search };
    }

    // Pagination
    const skip = (page - 1) * limit;

    // Sorting
    const sort = {};
    sort[sortBy] = sortOrder === "desc" ? -1 : 1;

    const clients = await Client.find(query)
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Client.countDocuments(query);

    res.status(200).json({
      success: true,
      data: {
        clients,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    console.error("Get clients error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching clients",
      error: error.message,
    });
  }
};

/**
 * @route   GET /api/clients/:id
 * @desc    Get client by ID
 * @access  Private
 */
const getClientById = async (req, res) => {
  try {
    const client = await Client.findOne({
      _id: req.params.id,
      user: req.userId,
    });

    if (!client) {
      return res.status(404).json({
        success: false,
        message: "Client not found",
      });
    }

    res.status(200).json({
      success: true,
      data: { client },
    });
  } catch (error) {
    console.error("Get client error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching client",
      error: error.message,
    });
  }
};

/**
 * @route   PUT /api/clients/:id
 * @desc    Update client
 * @access  Private
 */
const updateClient = async (req, res) => {
  try {
    const client = await Client.findOne({
      _id: req.params.id,
      user: req.userId,
    });

    if (!client) {
      return res.status(404).json({
        success: false,
        message: "Client not found",
      });
    }

    // Update fields
    Object.keys(req.body).forEach((key) => {
      if (key !== "user" && key !== "_id") {
        client[key] = req.body[key];
      }
    });

    await client.save();

    res.status(200).json({
      success: true,
      message: "Client updated successfully",
      data: { client },
    });
  } catch (error) {
    console.error("Update client error:", error);
    res.status(500).json({
      success: false,
      message: "Error updating client",
      error: error.message,
    });
  }
};

/**
 * @route   DELETE /api/clients/:id
 * @desc    Delete client
 * @access  Private
 */
const deleteClient = async (req, res) => {
  try {
    const client = await Client.findOneAndDelete({
      _id: req.params.id,
      user: req.userId,
    });

    if (!client) {
      return res.status(404).json({
        success: false,
        message: "Client not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Client deleted successfully",
    });
  } catch (error) {
    console.error("Delete client error:", error);
    res.status(500).json({
      success: false,
      message: "Error deleting client",
      error: error.message,
    });
  }
};

/**
 * @route   GET /api/clients/search
 * @desc    Search clients
 * @access  Private
 */
const searchClients = async (req, res) => {
  try {
    const { q } = req.query;

    if (!q) {
      return res.status(400).json({
        success: false,
        message: "Search query is required",
      });
    }

    const clients = await Client.searchClients(req.userId, q);

    res.status(200).json({
      success: true,
      data: { clients },
    });
  } catch (error) {
    console.error("Search clients error:", error);
    res.status(500).json({
      success: false,
      message: "Error searching clients",
      error: error.message,
    });
  }
};

/**
 * @route   GET /api/clients/:id/stats
 * @desc    Get client statistics
 * @access  Private
 */
const getClientStats = async (req, res) => {
  try {
    const client = await Client.findOne({
      _id: req.params.id,
      user: req.userId,
    });

    if (!client) {
      return res.status(404).json({
        success: false,
        message: "Client not found",
      });
    }

    // Get invoices for this client
    const Invoice = require("../models/Invoice").Invoice;
    const invoices = await Invoice.find({ client: client._id });

    const stats = {
      totalInvoices: invoices.length,
      paidInvoices: invoices.filter((inv) => inv.status === "paid").length,
      unpaidInvoices: invoices.filter(
        (inv) => inv.status === "sent" || inv.status === "viewed"
      ).length,
      overdueInvoices: invoices.filter((inv) => inv.status === "overdue")
        .length,
      totalAmount: invoices.reduce((sum, inv) => sum + inv.total, 0),
      totalPaid: invoices.reduce((sum, inv) => sum + inv.amountPaid, 0),
      totalDue: invoices.reduce((sum, inv) => sum + inv.amountDue, 0),
    };

    res.status(200).json({
      success: true,
      data: {
        client,
        stats,
      },
    });
  } catch (error) {
    console.error("Get client stats error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching client statistics",
      error: error.message,
    });
  }
};

/**
 * @route   GET /api/clients/active
 * @desc    Get active clients only
 * @access  Private
 */
const getActiveClients = async (req, res) => {
  try {
    const clients = await Client.getActiveClients(req.userId);

    res.status(200).json({
      success: true,
      data: { clients },
    });
  } catch (error) {
    console.error("Get active clients error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching active clients",
      error: error.message,
    });
  }
};

module.exports = {
  createClient,
  getAllClients,
  getClientById,
  updateClient,
  deleteClient,
  searchClients,
  getClientStats,
  getActiveClients,
};
