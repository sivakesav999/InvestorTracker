import express from "express";
import Investor from "../models/Investor.js";
import Payment from "../models/Payment.js";

import {
  getActualInvestment,
  getUpfrontCommission,
} from "../utils/investment.js";

const router = express.Router();

// --------------------------------------------------
// GET MY EARNINGS
// --------------------------------------------------

router.get("/earnings", async (req, res) => {
  try {
    const from = String(req.query.from || "").trim();
    const to = String(req.query.to || "").trim();

    // ------------------------------------------------
    // Date validation
    // ------------------------------------------------

    if (from && !/^\d{4}-\d{2}-\d{2}$/.test(from)) {
      return res.status(400).json({
        error: "Invalid from date",
      });
    }

    if (to && !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
      return res.status(400).json({
        error: "Invalid to date",
      });
    }

    if (from && to && from > to) {
      return res.status(400).json({
        error: "From date cannot be after To date",
      });
    }

    // ------------------------------------------------
    // 1. Initial commission
    // ------------------------------------------------
    //
    // Stored amount = total amount received.
    //
    // Example:
    //
    // Received:           ₹5,50,000
    // Actual investment: ₹5,00,000
    // Initial commission: ₹50,000
    //
    // Therefore the initial commission is derived
    // from the actual investment / received amount
    // relationship.
    //
    // It is earned when the investor is entered.
    // ------------------------------------------------

    const investorFilter = {};

    if (from || to) {
      investorFilter.createdAt = {};

      if (from) {
        investorFilter.createdAt.$gte = new Date(`${from}T00:00:00.000Z`);
      }

      if (to) {
        investorFilter.createdAt.$lte = new Date(`${to}T23:59:59.999Z`);
      }
    }

    const investors = await Investor.find(investorFilter)
      .select("_id investorCode name amount createdAt")
      .lean();

    const initialCommission = investors.reduce((total, investor) => {
      return total + getUpfrontCommission(investor.amount);
    }, 0);

    // ------------------------------------------------
    // 2. Monthly commission
    // ------------------------------------------------
    //
    // Uncle receives:
    //
    //   1% of ACTUAL INVESTMENT
    //
    // for every paid NORMAL monthly payment.
    //
    // No-payment investment month:
    //   ₹0 commission
    //
    // Complimentary payment:
    //   ₹0 commission
    //
    // Maturity payout:
    //   ₹0 commission
    // ------------------------------------------------

    const paymentFilter = {
      amountPaid: {
        $gt: 0,
      },
    };

    if (from || to) {
      paymentFilter.paymentDate = {};

      if (from) {
        paymentFilter.paymentDate.$gte = from;
      }

      if (to) {
        paymentFilter.paymentDate.$lte = to;
      }
    }

    const payments = await Payment.find(paymentFilter)
      .populate({
        path: "investorId",
        select: "_id investorCode name amount",
      })
      .lean();

    let monthlyCommission = 0;
    let complimentaryPayments = 0;

    let paidMonthlyPayments = 0;

    for (const payment of payments) {
      if (!payment.investorId) {
        continue;
      }

      // ------------------------------------------------
      // Complimentary payment
      // ------------------------------------------------

      if (payment.isComplimentary) {
        complimentaryPayments += Number(payment.amountPaid || 0);

        continue;
      }

      // ------------------------------------------------
      // No-payment row
      //
      // amountPaid > 0 is already required above,
      // so a no-payment row normally cannot reach here.
      // ------------------------------------------------

      if (Number(payment.amountDue || 0) <= 0) {
        continue;
      }

      // ------------------------------------------------
      // Normal monthly commission
      // ------------------------------------------------
      //
      // IMPORTANT:
      //
      // Use actual investment, NOT received amount.
      //
      // ₹5,50,000 received
      // → ₹5,00,000 actual investment
      // → ₹5,000 monthly commission
      // ------------------------------------------------

      const actualInvestment = getActualInvestment(payment.investorId.amount);

      monthlyCommission += actualInvestment * 0.01;

      paidMonthlyPayments += 1;
    }

    // ------------------------------------------------
    // Total earnings
    // ------------------------------------------------

    const totalEarnings = initialCommission + monthlyCommission;

    // ------------------------------------------------
    // Response
    // ------------------------------------------------

    res.json({
      from: from || null,
      to: to || null,

      initialCommission,

      monthlyCommission,

      totalEarnings,

      complimentaryPayments,

      investorsCount: investors.length,

      paidMonthlyPayments,
    });
  } catch (e) {
    console.error("Earnings calculation error:", e);

    res.status(500).json({
      error: e.message,
    });
  }
});

export default router;
