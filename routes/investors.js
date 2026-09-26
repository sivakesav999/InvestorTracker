import express from "express";
import Investor from "../models/Investor.js";
import Payment from "../models/Payment.js";

import {
  schemeInfo,
  addMonths,
  nextInvestorCode,
  createPayments,
  investorView,
  adjustedDuration,
  paymentDetails,
  isAfter15th,
} from "../utils/investment.js";

const router = express.Router();

// --------------------------------------------------
// GET ALL INVESTORS
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

    const investors = rows.map((row) => investorView(row));

    res.json(investors);
  } catch (e) {
    console.error("Get investors error:", e);

    res.status(500).json({
      error: e.message,
    });
  }
});

// --------------------------------------------------
// GET SINGLE INVESTOR + PAYMENTS
// --------------------------------------------------

router.get("/investors/:id", async (req, res) => {
  try {
    const row = await Investor.findById(req.params.id).lean();

    if (!row) {
      return res.status(404).json({
        error: "Investor not found",
      });
    }

    const investor = investorView(row);

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
    console.error("Get investor error:", e);

    res.status(500).json({
      error: e.message,
    });
  }
});

// --------------------------------------------------
// CREATE INVESTOR
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

    const numericAmount = Number(amount);

    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      return res.status(400).json({
        error: "Amount must be greater than 0",
      });
    }

    const investor = new Investor({
      investorCode: await nextInvestorCode(Investor),
      name,
      phone,
      address,
      investmentDate: investment_date,

      // Store total amount received.
      // Actual investment is calculated inside investment.js.
      amount: numericAmount,

      scheme,
      notes,
    });

    await investor.save();

    // Creates the schedule using the business rules
    // from investment.js.
    await createPayments(investor, Payment);

    res.json({
      ok: true,
      id: investor._id,
    });
  } catch (e) {
    console.error("Create investor error:", e);

    res.status(400).json({
      error: e.message,
    });
  }
});

// --------------------------------------------------
// SYNCHRONIZE INVESTOR PAYMENT SCHEDULE
// --------------------------------------------------

async function synchronizePayments(investor) {
  const duration = adjustedDuration(investor.investmentDate, investor.scheme);

  /*
    Backward-compatible function name from investment.js.

    Its current meaning is:

      investment date > 25th
  */
  const after25th = isAfter15th(investor.investmentDate);

  const existingPayments = await Payment.find({
    investorId: investor._id,
  })
    .sort({
      monthNo: 1,
    })
    .lean();

  const paymentMap = new Map(
    existingPayments.map((payment) => [payment.monthNo, payment]),
  );

  const operations = [];

  for (let month = 1; month <= duration; month += 1) {
    const dueDate = addMonths(investor.investmentDate, month - 1);

    const details = paymentDetails(
      investor.investmentDate,
      investor.scheme,
      investor.amount,
      month,
    );

    const existingPayment = paymentMap.get(month);

    // ------------------------------------------------
    // AFTER-25TH INVESTMENT MONTH
    // ------------------------------------------------
    //
    // Month 1 is a genuine "No Payment" month.
    //
    // Reset any old payment that may have been entered.
    // ------------------------------------------------

    const isNoPaymentMonth = after25th && month === 1;

    if (existingPayment) {
      if (isNoPaymentMonth) {
        operations.push({
          updateOne: {
            filter: {
              _id: existingPayment._id,
            },

            update: {
              $set: {
                dueDate,
                amountDue: details.amountDue,
                isComplimentary: false,

                // Clear the old automatic "No Payment" note
                // when this becomes a normal payment month.
                notes: details.noPayment
                  ? "No payment in investment month - investment made after 25th"
                  : "",
              },
            },
          },
        });
      } else {
        /*
          IMPORTANT:

          Recalculate amountDue every time.

          This handles both:

            1. Amount changes

            Example:

              Old:
                Received = ₹5,50,000
                Due = ₹11,000

              New:
                Actual investment = ₹5,00,000
                Due = ₹10,000

            2. Investment date changes

            Example:

              20th:
                First month = 2%

              10th:
                First month = selected scheme rate

          Historical payment information is preserved.
        */

        operations.push({
          updateOne: {
            filter: {
              _id: existingPayment._id,
            },

            update: {
              $set: {
                dueDate,
                amountDue: details.amountDue,
                isComplimentary: false,

                /*
                  If the payment is the 16th–25th
                  investment-month payment, paymentDetails()
                  has already calculated the 2% amount.

                  We therefore do not need special handling here.
                */
              },
            },
          },
        });
      }
    } else {
      // Create missing payment row.
      operations.push({
        insertOne: {
          document: {
            investorId: investor._id,
            monthNo: month,
            dueDate,

            amountDue: isNoPaymentMonth ? 0 : details.amountDue,

            amountPaid: 0,
            paymentDate: "",
            method: "",

            notes: isNoPaymentMonth
              ? "No payment in investment month - investment made after 25th"
              : "",

            isComplimentary: false,
          },
        },
      });
    }
  }

  if (operations.length > 0) {
    await Payment.bulkWrite(operations);
  }
}

// --------------------------------------------------
// UPDATE INVESTOR
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

    if (
      !name ||
      !investment_date ||
      !Number.isFinite(newAmount) ||
      newAmount <= 0
    ) {
      return res.status(400).json({
        error: "Name, investment date and amount are required",
      });
    }

    const existingInvestor = await Investor.findById(req.params.id);

    if (!existingInvestor) {
      return res.status(404).json({
        error: "Investor not found",
      });
    }

    // Update investor information.
    existingInvestor.name = name;
    existingInvestor.phone = phone;
    existingInvestor.address = address;
    existingInvestor.investmentDate = investment_date;
    existingInvestor.amount = newAmount;
    existingInvestor.scheme = scheme;
    existingInvestor.notes = notes;

    await existingInvestor.save();

    /*
      ALWAYS synchronize the payment schedule.

      This is important because existing investors may
      have been created using the old calculation.

      Example:

        Old:
          Received = ₹5,50,000
          Due = ₹11,000

        New:
          Actual investment = ₹5,00,000
          Due = ₹10,000

      It also corrects old investment-date rules.

      Example:

        Investment date = 20th

        New first-month rule:
          2%

      Investment date = 26th

        New first-month rule:
          ₹0
    */

    await synchronizePayments(existingInvestor);

    res.json({
      ok: true,
      paymentsUpdated: true,
    });
  } catch (e) {
    console.error("Update investor error:", e);

    res.status(400).json({
      error: e.message,
    });
  }
});

// --------------------------------------------------
// DELETE INVESTOR
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
    console.error("Delete investor error:", e);

    res.status(400).json({
      error: e.message,
    });
  }
});

export default router;
