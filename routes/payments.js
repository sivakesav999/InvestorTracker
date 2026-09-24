import express from "express";
import mongoose from "mongoose";
import Payment from "../models/Payment.js";

const router = express.Router();


// --------------------------------------------------
// Update Multiple Payments
// --------------------------------------------------

router.put("/payments/bulk", async (req, res) => {
  try {
    const payments = Array.isArray(req.body?.payments)
      ? req.body.payments
      : [];

    if (!payments.length) {
      return res.status(400).json({
        error: "No payments supplied",
      });
    }

    for (const payment of payments) {
      if (!mongoose.isValidObjectId(payment.id)) {
        return res.status(400).json({
          error: "Invalid payment ID",
        });
      }

      if (!["", "Cash", "UPI"].includes(payment.method || "")) {
        return res.status(400).json({
          error: "Payment method must be Cash or UPI",
        });
      }
    }

    await Payment.bulkWrite(
      payments.map((payment) => ({
        updateOne: {
          filter: {
            _id: payment.id,
          },

          update: {
            $set: {
              amountPaid: Number(payment.amount_paid) || 0,
              paymentDate: payment.payment_date || "",
              method: payment.method || "",
              notes: payment.notes || "",
            },
          },
        },
      })),
    );

    res.json({
      ok: true,
      count: payments.length,
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

router.put("/payments/:id", async (req, res) => {
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


export default router;