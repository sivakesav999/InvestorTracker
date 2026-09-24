import "dotenv/config";
import express from "express";
import session from "express-session";
import mongoose from "mongoose";
import crypto from "crypto";
import XLSX from "xlsx";
import path from "path";
import { fileURLToPath } from "url";

import Investor from "./models/Investor.js";
import Payment from "./models/Payment.js";

import paymentRoutes from "./routes/payments.js";
import investorRoutes from "./routes/investors.js";

import { schemes } from "./utils/investment.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;

const MONGODB_URI = process.env.MONGODB_URI;
const ADMIN_USER = process.env.ADMIN_USER || "admin";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "ChangeMe123!";
const SESSION_SECRET =
  process.env.SESSION_SECRET || crypto.randomBytes(32).toString("hex");

const clientDist = path.join(__dirname, "client", "dist");

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
// Middleware
// --------------------------------------------------

app.use(express.json());

app.use(
  session({
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    rolling: true,

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

  return res.status(401).json({
    error: "Authentication required",
  });
}

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

  return res.status(401).json({
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

app.use("/api", paymentRoutes);
app.use("/api", investorRoutes);

// --------------------------------------------------
// Schemes API
// --------------------------------------------------

app.get("/api/schemes", (req, res) => {
  res.json(Object.keys(schemes));
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
// React Production Frontend
// --------------------------------------------------

// Serve Vite's production build.
// API routes above always take precedence.
app.use(express.static(clientDist, { index: false }));

// --------------------------------------------------
// Root
// --------------------------------------------------

app.get("/", (req, res) => {
  if (!req.session?.authenticated) {
    return res.redirect("/login");
  }

  return res.sendFile(path.join(clientDist, "index.html"));
});

// --------------------------------------------------
// React Login Route
// --------------------------------------------------

app.get("/login", (req, res) => {
  return res.sendFile(path.join(clientDist, "index.html"));
});

// --------------------------------------------------
// Legacy Login URL Compatibility
// --------------------------------------------------

// Prevent old bookmarks/links from opening the legacy login page.
app.get("/login.html", (req, res) => {
  if (req.session?.authenticated) {
    return res.redirect("/");
  }

  return res.redirect("/login");
});

// --------------------------------------------------
// Legacy Index URL Compatibility
// --------------------------------------------------

app.get("/index.html", (req, res) => {
  if (!req.session?.authenticated) {
    return res.redirect("/login");
  }

  return res.redirect("/");
});

// --------------------------------------------------
// React SPA Fallback
// --------------------------------------------------

// React Router handles client-side routes such as /login.
// Never use the React fallback for API requests or missing
// files with extensions.
app.use((req, res) => {
  if (req.method !== "GET") {
    return res.status(404).json({
      error: "Not found",
    });
  }

  if (req.path.startsWith("/api/")) {
    return res.status(404).json({
      error: "API route not found",
    });
  }

  if (path.extname(req.path)) {
    return res.status(404).end();
  }

  if (!req.session?.authenticated) {
    return res.redirect("/login");
  }

  return res.sendFile(path.join(clientDist, "index.html"));
});

// --------------------------------------------------
// Start Server
// --------------------------------------------------

app.listen(PORT, () => {
  console.log(`Investment Tracker running on port ${PORT}`);
});
