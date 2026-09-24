import express from "express";
import mongoose from "mongoose";

import Investor from "../models/Investor.js";
import Payment from "../models/Payment.js";

import {
  schemeInfo,
  addMonths,
  nextInvestorCode,
  createPayments,
  investorView,
} from "../utils/investment.js";

const router = express.Router();

// --------------------------------------------------
// Get Investors
// --------------------------------------------------

router.get("/investors", async (req, res) => {
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

router.get("/investors/:id", async (req, res) => {
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
// Create Investor
// --------------------------------------------------

router.post("/investors", async (req, res) => {
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
      investorCode: await nextInvestorCode(Investor),

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

router.put("/investors/:id", async (req, res) => {
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

    const newAmount = Number(amount);

    if (!name || !investment_date || !newAmount) {
      return res.status(400).json({
        error: "Name, investment date and amount are required",
      });
    }

    // Get the existing investor first
    const existingInvestor = await Investor.findById(req.params.id);

    if (!existingInvestor) {
      return res.status(404).json({
        error: "Investor not found",
      });
    }

    // Check whether the payment schedule itself changed
    const scheduleChanged =
      existingInvestor.amount !== newAmount ||
      existingInvestor.scheme !== scheme ||
      existingInvestor.investmentDate !== investment_date;

    // Update investor information
    existingInvestor.name = name;
    existingInvestor.phone = phone;
    existingInvestor.address = address;
    existingInvestor.investmentDate = investment_date;
    existingInvestor.amount = newAmount;
    existingInvestor.scheme = scheme;
    existingInvestor.notes = notes;

    await existingInvestor.save();

    // If only personal/details fields changed,
    // do NOT touch payment records.
    if (!scheduleChanged) {
      return res.json({
        ok: true,
        paymentsUpdated: false,
      });
    }

    // --------------------------------------------------
    // Payment schedule changed
    // Preserve existing payment history
    // --------------------------------------------------

    const info = schemeInfo(existingInvestor.scheme);

    const existingPayments = await Payment.find({
      investorId: existingInvestor._id,
    }).lean();

    const paymentMap = new Map(
      existingPayments.map((payment) => [payment.monthNo, payment]),
    );

    const operations = [];

    for (let month = 1; month <= info.months; month++) {
      const dueDate = addMonths(existingInvestor.investmentDate, month - 1);

      const amountDue = existingInvestor.amount * info.rate;

      const existingPayment = paymentMap.get(month);

      if (existingPayment) {
        // Keep payment history.
        // Only update the new schedule information.
        operations.push({
          updateOne: {
            filter: {
              _id: existingPayment._id,
            },
            update: {
              $set: {
                dueDate,
                amountDue,
              },
            },
          },
        });
      } else {
        // Create a missing future payment record.
        operations.push({
          insertOne: {
            document: {
              investorId: existingInvestor._id,
              monthNo: month,
              dueDate,
              amountDue,
              amountPaid: 0,
              paymentDate: "",
              method: "",
              notes: "",
            },
          },
        });
      }
    }

    if (operations.length) {
      await Payment.bulkWrite(operations);
    }

    res.json({
      ok: true,
      paymentsUpdated: true,
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

router.delete("/investors/:id", async (req, res) => {
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

export default router;
