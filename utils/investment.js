// utils/investment.js

import Payment from "../models/Payment.js";

// --------------------------------------------------
// Schemes
// --------------------------------------------------

export const schemes = [
  "20 Months - 10%",
  "12 Months - 2%",
  "36 Months - 2.5%",
];

export function schemeInfo(scheme) {
  switch (scheme) {
    case "20 Months - 10%":
      return {
        months: 20,
        rate: 0.1,
        maturityMultiplier: null,
      };

    case "12 Months - 2%":
      return {
        months: 12,
        rate: 0.02,
        maturityMultiplier: 2,
      };

    case "36 Months - 2.5%":
      return {
        months: 36,
        rate: 0.025,
        maturityMultiplier: 2,
      };

    default:
      throw new Error(`Unknown scheme: ${scheme}`);
  }
}

// --------------------------------------------------
// Amount / Commission Rules
// --------------------------------------------------

/*
  The amount stored for an investor is the TOTAL AMOUNT
  RECEIVED from the investor.

  Every ₹1,10,000 received is split as:

    ₹1,00,000 -> Actual Investment
    ₹10,000   -> Upfront Commission

  Therefore:

    Actual Investment = Received Amount / 1.10

    Upfront Commission = Received Amount - Actual Investment

  Examples:

    ₹1,10,000 -> ₹1,00,000 actual + ₹10,000 commission

    ₹2,20,000 -> ₹2,00,000 actual + ₹20,000 commission

    ₹5,50,000 -> ₹5,00,000 actual + ₹50,000 commission
*/

export function getActualInvestment(receivedAmount) {
  const amount = Number(receivedAmount) || 0;

  return amount / 1.1;
}

export function getUpfrontCommission(receivedAmount) {
  const amount = Number(receivedAmount) || 0;
  const actualInvestment = getActualInvestment(amount);

  return amount - actualInvestment;
}

// --------------------------------------------------
// Date Helpers
// --------------------------------------------------

export function parseDate(dateString) {
  const [year, month, day] = String(dateString).split("-").map(Number);

  return new Date(year, month - 1, day);
}

export function addMonths(dateString, months) {
  const [year, month, day] = String(dateString).split("-").map(Number);

  const date = new Date(year, month - 1, day);

  date.setMonth(date.getMonth() + months);

  const resultYear = date.getFullYear();
  const resultMonth = String(date.getMonth() + 1).padStart(2, "0");
  const resultDay = String(date.getDate()).padStart(2, "0");

  return `${resultYear}-${resultMonth}-${resultDay}`;
}

export function formatDate(dateString) {
  if (!dateString) {
    return "";
  }

  const [year, month, day] = String(dateString).split("-").map(Number);

  if (!year || !month || !day) {
    return dateString;
  }

  return `${String(day).padStart(2, "0")}-${String(month).padStart(
    2,
    "0",
  )}-${year}`;
}

// --------------------------------------------------
// Investment Date Rules
// --------------------------------------------------

/*
  FINAL BUSINESS RULE
  -------------------

  Investment made from 1st to 15th:

    - Normal selected scheme rate applies
    - Normal monthly commission applies
    - Normal scheme tenure

  Investment made from 16th to 25th:

    - 2% payout applies for the investment month
    - Normal monthly commission applies
    - Normal scheme tenure
    - From the following month, the selected scheme's
      normal rate applies

  Investment made after 25th:

    - No payment in investment month
    - No monthly commission in investment month
    - Normal selected scheme payment starts next month
    - Effective tenure increases by 1 month
*/

// --------------------------------------------------
// Investment Date Classification
// --------------------------------------------------

export function getInvestmentDateCategory(investmentDate) {
  const [, , day] = String(investmentDate).split("-").map(Number);

  if (day >= 1 && day <= 15) {
    return "NORMAL";
  }

  if (day >= 16 && day <= 25) {
    return "SPECIAL_2_PERCENT";
  }

  return "NO_PAYMENT";
}

// --------------------------------------------------
// Backward-Compatible Helper
// --------------------------------------------------

/*
  Existing routes may still import isAfter15th().

  We keep the function so existing code does not break,
  but its meaning is now:

    "investment is after the 25th"

  This can be renamed later when we update the routes.
*/

export function isAfter15th(investmentDate) {
  return getInvestmentDateCategory(investmentDate) === "NO_PAYMENT";
}

// --------------------------------------------------
// Effective Tenure
// --------------------------------------------------

export function getEffectiveTenure(investmentDate, scheme) {
  const info = schemeInfo(scheme);

  /*
    Only investments after the 25th receive an
    additional tenure month because there is no
    payment during the investment month.
  */

  return info.months + (isAfter15th(investmentDate) ? 1 : 0);
}

export function adjustedDuration(investmentDate, scheme) {
  return getEffectiveTenure(investmentDate, scheme);
}

// --------------------------------------------------
// Monthly Payout
// --------------------------------------------------

export function getMonthlyPayout(
  receivedAmount,
  scheme,
  investmentDate,
  monthNo,
) {
  const info = schemeInfo(scheme);

  const actualInvestment = getActualInvestment(receivedAmount);

  const dateCategory = getInvestmentDateCategory(investmentDate);

  // ------------------------------------------------
  // Investment date: 26th to 31st
  // ------------------------------------------------

  /*
    No payment in the investment month.

    This is NOT a complimentary payment.

    It is a real zero-payment month.
  */

  if (monthNo === 1 && dateCategory === "NO_PAYMENT") {
    return {
      amount: 0,
      complimentary: false,
      noPayment: true,
    };
  }

  // ------------------------------------------------
  // Investment date: 16th to 25th
  // ------------------------------------------------

  /*
    For the investment month only, 2% applies
    regardless of the selected scheme.

    Example:

      ₹1,00,000 actual investment

      Scheme 1 -> ₹2,000
      Scheme 2 -> ₹2,000
      Scheme 3 -> ₹2,000
  */

  if (monthNo === 1 && dateCategory === "SPECIAL_2_PERCENT") {
    return {
      amount: actualInvestment * 0.02,
      complimentary: false,
      noPayment: false,
    };
  }

  // ------------------------------------------------
  // Normal scheme payout
  // ------------------------------------------------

  /*
    For:

      - 1st to 15th investment dates
      - Month 2 onward for 16th to 25th
      - Month 2 onward for after-25th investments

    the selected scheme's normal rate applies.
  */

  return {
    amount: actualInvestment * info.rate,
    complimentary: false,
    noPayment: false,
  };
}

// --------------------------------------------------
// Payment Details
// --------------------------------------------------

export function paymentDetails(
  investmentDate,
  scheme,
  receivedAmount,
  monthNo,
) {
  const payout = getMonthlyPayout(
    receivedAmount,
    scheme,
    investmentDate,
    monthNo,
  );

  return {
    amountDue: payout.amount,
    isComplimentary: payout.complimentary,
    noPayment: payout.noPayment,
  };
}

// --------------------------------------------------
// Completed Months
// --------------------------------------------------

export function monthsCompleted(investmentDate) {
  const start = parseDate(investmentDate);
  const now = new Date();

  let months =
    (now.getFullYear() - start.getFullYear()) * 12 +
    (now.getMonth() - start.getMonth());

  if (now.getDate() < start.getDate()) {
    months -= 1;
  }

  return Math.max(0, months);
}

// --------------------------------------------------
// Investor Code
// --------------------------------------------------

export function nextInvestorCode(Investor) {
  return Investor.findOne()
    .sort({
      investorCode: -1,
    })
    .lean()
    .then((last) => {
      if (!last?.investorCode) {
        return "INV-001";
      }

      const match = String(last.investorCode).match(/(\d+)$/);

      const nextNumber = match ? Number(match[1]) + 1 : 1;

      return `INV-${String(nextNumber).padStart(3, "0")}`;
    });
}

// --------------------------------------------------
// Create Payment Schedule
// --------------------------------------------------

export async function createPayments(investor, Payment) {
  const totalMonths = getEffectiveTenure(
    investor.investmentDate,
    investor.scheme,
  );

  const payments = [];

  for (let monthNo = 1; monthNo <= totalMonths; monthNo += 1) {
    const dueDate = addMonths(investor.investmentDate, monthNo - 1);

    const details = paymentDetails(
      investor.investmentDate,
      investor.scheme,
      investor.amount,
      monthNo,
    );

    payments.push({
      investorId: investor._id,
      monthNo,
      dueDate,
      amountDue: details.amountDue,
      amountPaid: 0,
      paymentDate: "",
      method: "",
      notes: details.noPayment
        ? "No payment in investment month - investment made after 25th"
        : "",
      isComplimentary: false,
    });
  }

  if (payments.length) {
    await Payment.insertMany(payments);
  }

  return payments;
}

// --------------------------------------------------
// Investor View
// --------------------------------------------------

export function investorView(row) {
  const completedMonths = monthsCompleted(row.investmentDate);

  const totalMonths = getEffectiveTenure(row.investmentDate, row.scheme);

  const tenureCompleted = completedMonths >= totalMonths;

  const effectiveCompletedMonths = Math.min(completedMonths, totalMonths);

  const remainingMonths = tenureCompleted
    ? 0
    : Math.max(totalMonths - effectiveCompletedMonths, 0);

  const info = schemeInfo(row.scheme);

  /*
    IMPORTANT:

    row.amount is the TOTAL AMOUNT RECEIVED.

    Scheme calculations use only the ACTUAL INVESTMENT.
  */

  const actualInvestment = getActualInvestment(row.amount);

  const upfrontCommission = getUpfrontCommission(row.amount);

  const monthlyPayout = actualInvestment * info.rate;

  const maturityDate = addMonths(row.investmentDate, totalMonths);

  const maturityAmount =
    info.maturityMultiplier === null
      ? 0
      : actualInvestment * info.maturityMultiplier;

  return {
    ...row,

    id: row._id?.toString?.() || row.id,

    completedMonths: effectiveCompletedMonths,

    remainingMonths,

    totalMonths,

    /*
      Original received amount remains visible.
    */
    amount: Number(row.amount),

    /*
      New calculated values.
    */
    actualInvestment,

    upfrontCommission,

    monthlyPayout,

    maturityDate,

    maturityAmount,

    /*
      Keep this name for compatibility with
      existing frontend code.
    */
    initialCommission: upfrontCommission,

    tenureCompleted,

    tenureMessage: tenureCompleted ? "Tenure Completed" : "",
  };
}
