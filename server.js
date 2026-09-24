import "dotenv/config";
import express from "express";
import session from "express-session";
import mongoose from "mongoose";
import crypto from "crypto";
import XLSX from "xlsx";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;

const MONGODB_URI = process.env.MONGODB_URI;
const ADMIN_USER = process.env.ADMIN_USER || "admin";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "ChangeMe123!";
const SESSION_SECRET =
  process.env.SESSION_SECRET || crypto.randomBytes(32).toString("hex");

if (!MONGODB_URI) {
  console.error("Missing MONGODB_URI environment variable.");
  process.exit(1);
}

// --------------------------------------------------
// MongoDB
// --------------------------------------------------

await mongoose.connect(MONGODB_URI);
console.log("Connected to MongoDB");

// --------------------------------------------------
// Investor Schema
// --------------------------------------------------

const investorSchema = new mongoose.Schema(
  {
    investorCode: {
      type: String,
      unique: true,
      index: true,
    },

    name: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },

    phone: {
      type: String,
      default: "",
      index: true,
    },

    address: {
      type: String,
      default: "",
    },

    investmentDate: {
      type: String,
      required: true,
    },

    amount: {
      type: Number,
      required: true,
      min: 0,
    },

    scheme: {
      type: String,
      required: true,
    },

    notes: {
      type: String,
      default: "",
    },
  },
  {
    timestamps: true,
  },
);

// --------------------------------------------------
// Payment Schema
// --------------------------------------------------

const paymentSchema = new mongoose.Schema(
  {
    investorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Investor",
      required: true,
      index: true,
    },

    monthNo: {
      type: Number,
      required: true,
    },

    dueDate: {
      type: String,
    },

    amountDue: {
      type: Number,
      default: 0,
    },

    amountPaid: {
      type: Number,
      default: 0,
    },

    paymentDate: {
      type: String,
      default: "",
    },

    method: {
      type: String,
      enum: ["", "Cash", "UPI"],
      default: "",
    },

    notes: {
      type: String,
      default: "",
    },
  },
  {
    timestamps: true,
  },
);

paymentSchema.index(
  {
    investorId: 1,
    monthNo: 1,
  },
  {
    unique: true,
  },
);

const Investor = mongoose.model("Investor", investorSchema);
const Payment = mongoose.model("Payment", paymentSchema);

// --------------------------------------------------
// Schemes
// --------------------------------------------------

const schemes = {
  "20 Months - 10%": {
    months: 20,
    rate: 0.1,
    maturityMultiplier: 0,
  },

  "12 Months - 2%": {
    months: 12,
    rate: 0.02,
    maturityMultiplier: 2,
  },

  "36 Months - 2.5%": {
    months: 36,
    rate: 0.025,
    maturityMultiplier: 2,
  },
};

// --------------------------------------------------
// Middleware
// --------------------------------------------------

app.use(express.json());

app.use(
  session({
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,

    cookie: {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 1000 * 60 * 60 * 8,
    },
  }),
);

// --------------------------------------------------
// Authentication
// --------------------------------------------------

function requireAuth(req, res, next) {
  if (req.session?.authenticated) {
    return next();
  }

  res.status(401).json({
    error: "Authentication required",
  });
}

// --------------------------------------------------
// Helper Functions
// --------------------------------------------------

function schemeInfo(scheme) {
  if (!schemes[scheme]) {
    throw new Error("Invalid scheme");
  }

  return schemes[scheme];
}

function addMonths(dateString, months) {
  const d = new Date(dateString + "T00:00:00");

  d.setMonth(d.getMonth() + months);

  return d.toISOString().slice(0, 10);
}

function monthsCompleted(start) {
  const s = new Date(start + "T00:00:00");
  const n = new Date();

  let months =
    (n.getFullYear() - s.getFullYear()) * 12 + n.getMonth() - s.getMonth();

  if (n.getDate() < s.getDate()) {
    months--;
  }

  return Math.max(0, months);
}

// --------------------------------------------------
// Generate Investor ID
// --------------------------------------------------

async function nextInvestorCode() {
  const latest = await Investor.findOne()
    .sort({
      createdAt: -1,
    })
    .lean();

  const n = latest?.investorCode?.match(/(\d+)$/)?.[1];

  return "INV-" + String((Number(n) || 0) + 1).padStart(4, "0");
}

// --------------------------------------------------
// Investor View
// --------------------------------------------------

async function investorView(row) {
  const info = schemeInfo(row.scheme);

  const monthly = row.amount * info.rate;

  const maturity =
    row.amount * info.maturityMultiplier;

  // Get all payment records for this investor
  const payments = await Payment.find({
    investorId: row._id
  })
    .sort({ monthNo: 1 })
    .lean();

  // A month is considered COMPLETED only when
  // the full amount due has been paid.
  const completed = payments.filter(
    (p) =>
      Number(p.amountPaid || 0) >=
      Number(p.amountDue || 0)
  ).length;

  const monthsCompleted = Math.min(
    info.months,
    completed
  );

  const monthsRemaining = Math.max(
    0,
    info.months - monthsCompleted
  );

  // Total amount actually paid
  const totalPaid = payments.reduce(
    (sum, p) =>
      sum + Number(p.amountPaid || 0),
    0
  );

  // Total amount still pending from monthly payouts
  const totalDue = payments.reduce(
    (sum, p) =>
      sum +
      Math.max(
        0,
        Number(p.amountDue || 0) -
          Number(p.amountPaid || 0)
      ),
    0
  );

  return {
    id: row._id,

    investorCode: row.investorCode,

    name: row.name,

    phone: row.phone,

    address: row.address,

    investmentDate: row.investmentDate,

    amount: row.amount,

    scheme: row.scheme,

    notes: row.notes,

    duration: info.months,

    monthlyPayout: monthly,

    maturityAmount: maturity,

    maturityDate: addMonths(
      row.investmentDate,
      info.months
    ),

    monthsCompleted,

    monthsRemaining,

    totalPaid,

    totalDue,

    status:
      monthsCompleted >= info.months
        ? "Matured"
        : "Active"
  };
}

// --------------------------------------------------
// Login Page
// --------------------------------------------------

app.get("/login.html", (req, res) => {
  if (req.session?.authenticated) {
    return res.redirect("/");
  }

  res.sendFile(path.join(__dirname, "public", "login.html"));
});

// --------------------------------------------------
// Login API
// --------------------------------------------------

app.post("/api/login", (req, res) => {
  const { username, password } = req.body || {};

  if (username === ADMIN_USER && password === ADMIN_PASSWORD) {
    req.session.authenticated = true;
    req.session.username = username;

    return res.json({
      ok: true,
    });
  }

  res.status(401).json({
    error: "Invalid username or password",
  });
});

// --------------------------------------------------
// Logout
// --------------------------------------------------

app.post("/api/logout", (req, res) => {
  req.session.destroy(() => {
    res.json({
      ok: true,
    });
  });
});

// --------------------------------------------------
// Authentication Check
// --------------------------------------------------

app.get("/api/auth", (req, res) => {
  res.json({
    authenticated: !!req.session?.authenticated,

    username: req.session?.username || null,
  });
});

// --------------------------------------------------
// Protect All API Routes
// --------------------------------------------------

app.use("/api", requireAuth);

// --------------------------------------------------
// Schemes API
// --------------------------------------------------

app.get("/api/schemes", (req, res) => {
  res.json(Object.keys(schemes));
});

// --------------------------------------------------
// Get Investors
// --------------------------------------------------

app.get("/api/investors", async (req, res) => {
  try {
    const q = (req.query.q || "").trim();

    const filter = q
      ? {
          $or: [
            {
              investorCode: {
                $regex: q,
                $options: "i",
              },
            },

            {
              name: {
                $regex: q,
                $options: "i",
              },
            },

            {
              phone: {
                $regex: q,
                $options: "i",
              },
            },
          ],
        }
      : {};

    const rows = await Investor.find(filter)
      .sort({
        createdAt: -1,
      })
      .lean();

    res.json(await Promise.all(rows.map(investorView)));
  } catch (e) {
    res.status(500).json({
      error: e.message,
    });
  }
});

// --------------------------------------------------
// Get Single Investor + Payments
// --------------------------------------------------

app.get("/api/investors/:id", async (req, res) => {
  try {
    const row = await Investor.findById(req.params.id).lean();

    if (!row) {
      return res.status(404).json({
        error: "Investor not found",
      });
    }

    const investor = await investorView(row);

    const payments = await Payment.find({
      investorId: row._id,
    })
      .sort({
        monthNo: 1,
      })
      .lean();

    res.json({
      investor,
      payments,
    });
  } catch (e) {
    res.status(500).json({
      error: e.message,
    });
  }
});

// --------------------------------------------------
// Create Monthly Payment Schedule
// --------------------------------------------------

async function createPayments(investor) {
  const info = schemeInfo(investor.scheme);

  const docs = [];

  for (let month = 1; month <= info.months; month++) {
    docs.push({
      investorId: investor._id,

      monthNo: month,

      dueDate: addMonths(investor.investmentDate, month - 1),

      amountDue: investor.amount * info.rate,
    });
  }

  await Payment.insertMany(docs, {
    ordered: false,
  });
}

// --------------------------------------------------
// Create Investor
// --------------------------------------------------

app.post("/api/investors", async (req, res) => {
  try {
    const {
      name,
      phone = "",
      address = "",
      investment_date,
      amount,
      scheme,
      notes = "",
    } = req.body;

    schemeInfo(scheme);

    if (!name || !investment_date || !amount) {
      return res.status(400).json({
        error: "Name, investment date and amount are required",
      });
    }

    const investor = new Investor({
      investorCode: await nextInvestorCode(),

      name,

      phone,

      address,

      investmentDate: investment_date,

      amount: Number(amount),

      scheme,

      notes,
    });

    await investor.save();

    await createPayments(investor);

    res.json({
      ok: true,
      id: investor._id,
    });
  } catch (e) {
    res.status(400).json({
      error: e.message,
    });
  }
});

// --------------------------------------------------
// Update Investor
// --------------------------------------------------

app.put("/api/investors/:id", async (req, res) => {
  try {
    const {
      name,
      phone = "",
      address = "",
      investment_date,
      amount,
      scheme,
      notes = "",
    } = req.body;

    schemeInfo(scheme);

    const investor = await Investor.findByIdAndUpdate(
      req.params.id,

      {
        name,

        phone,

        address,

        investmentDate: investment_date,

        amount: Number(amount),

        scheme,

        notes,
      },

      {
        new: true,
        runValidators: true,
      },
    );

    if (!investor) {
      return res.status(404).json({
        error: "Investor not found",
      });
    }

    await Payment.deleteMany({
      investorId: investor._id,
    });

    await createPayments(investor);

    res.json({
      ok: true,
    });
  } catch (e) {
    res.status(400).json({
      error: e.message,
    });
  }
});

// --------------------------------------------------
// Update Payment
// --------------------------------------------------

app.put("/api/payments/:id", async (req, res) => {
  try {
    const {
      amount_paid = 0,
      payment_date = "",
      method = "",
      notes = "",
    } = req.body;

    if (!["", "Cash", "UPI"].includes(method)) {
      return res.status(400).json({
        error: "Payment method must be Cash or UPI",
      });
    }

    await Payment.findByIdAndUpdate(
      req.params.id,

      {
        amountPaid: Number(amount_paid) || 0,

        paymentDate: payment_date,

        method,

        notes,
      },

      {
        runValidators: true,
      },
    );

    res.json({
      ok: true,
    });
  } catch (e) {
    res.status(400).json({
      error: e.message,
    });
  }
});

// --------------------------------------------------
// Delete Investor
// --------------------------------------------------

app.delete("/api/investors/:id", async (req, res) => {
  try {
    await Payment.deleteMany({
      investorId: req.params.id,
    });

    await Investor.findByIdAndDelete(req.params.id);

    res.json({
      ok: true,
    });
  } catch (e) {
    res.status(400).json({
      error: e.message,
    });
  }
});

// --------------------------------------------------
// Dashboard
// --------------------------------------------------

app.get("/api/dashboard", async (req, res) => {
  try {
    const [inv, paid, cash, upi, pending] = await Promise.all([
      Investor.aggregate([
        {
          $group: {
            _id: null,

            n: {
              $sum: 1,
            },

            invested: {
              $sum: "$amount",
            },
          },
        },
      ]),

      Payment.aggregate([
        {
          $group: {
            _id: null,

            paid: {
              $sum: "$amountPaid",
            },
          },
        },
      ]),

      Payment.aggregate([
        {
          $match: {
            method: "Cash",
          },
        },

        {
          $group: {
            _id: null,

            v: {
              $sum: "$amountPaid",
            },
          },
        },
      ]),

      Payment.aggregate([
        {
          $match: {
            method: "UPI",
          },
        },

        {
          $group: {
            _id: null,

            v: {
              $sum: "$amountPaid",
            },
          },
        },
      ]),

      Payment.aggregate([
        {
          $project: {
            d: {
              $subtract: ["$amountDue", "$amountPaid"],
            },
          },
        },

        {
          $match: {
            d: {
              $gt: 0,
            },
          },
        },

        {
          $group: {
            _id: null,

            v: {
              $sum: "$d",
            },
          },
        },
      ]),
    ]);

    res.json({
      investors: inv[0]?.n || 0,

      invested: inv[0]?.invested || 0,

      paid: paid[0]?.paid || 0,

      cash: cash[0]?.v || 0,

      upi: upi[0]?.v || 0,

      pending: pending[0]?.v || 0,
    });
  } catch (e) {
    res.status(500).json({
      error: e.message,
    });
  }
});

// --------------------------------------------------
// Excel Export
// --------------------------------------------------

app.get("/api/export", async (req, res) => {
  try {
    const investors = await Investor.find()
      .sort({
        createdAt: 1,
      })
      .lean();

    const payments = await Payment.find()
      .populate("investorId", "investorCode name scheme")
      .sort({
        investorId: 1,
        monthNo: 1,
      })
      .lean();

    const invRows = investors.map((x) => ({
      investorId: x.investorCode,

      name: x.name,

      phone: x.phone,

      address: x.address,

      investmentDate: x.investmentDate,

      amount: x.amount,

      scheme: x.scheme,

      notes: x.notes,
    }));

    const payRows = payments.map((p) => ({
      investorId: p.investorId?.investorCode,

      name: p.investorId?.name,

      scheme: p.investorId?.scheme,

      monthNo: p.monthNo,

      dueDate: p.dueDate,

      amountDue: p.amountDue,

      amountPaid: p.amountPaid,

      paymentDate: p.paymentDate,

      method: p.method,

      notes: p.notes,
    }));

    const wb = XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(
      wb,

      XLSX.utils.json_to_sheet(invRows),

      "Investors",
    );

    XLSX.utils.book_append_sheet(
      wb,

      XLSX.utils.json_to_sheet(payRows),

      "Payment Ledger",
    );

    const out = XLSX.write(wb, {
      type: "buffer",
      bookType: "xlsx",
    });

    res.setHeader(
      "Content-Disposition",
      'attachment; filename="investment-tracker-export.xlsx"',
    );

    res.type(
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );

    res.send(out);
  } catch (e) {
    res.status(500).json({
      error: e.message,
    });
  }
});

// --------------------------------------------------
// PROTECTED FRONTEND
// --------------------------------------------------

// IMPORTANT:
// These routes must come BEFORE express.static()
// so unauthenticated users cannot directly open
// the dashboard.

app.get("/", (req, res) => {
  if (!req.session?.authenticated) {
    return res.redirect("/login.html");
  }

  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.get("/index.html", (req, res) => {
  if (!req.session?.authenticated) {
    return res.redirect("/login.html");
  }

  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// --------------------------------------------------
// Static Files
// --------------------------------------------------

app.use(express.static(path.join(__dirname, "public")));

// --------------------------------------------------
// Unknown Routes
// --------------------------------------------------

app.use((req, res) => {
  if (!req.session?.authenticated) {
    return res.redirect("/login.html");
  }

  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// --------------------------------------------------
// Start Server
// --------------------------------------------------

app.listen(PORT, () =>
  console.log(`Investment Tracker running on port ${PORT}`),
);
