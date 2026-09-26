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
      return { months: 20, rate: 0.1, maturityMultiplier: null };

    case "12 Months - 2%":
      return { months: 12, rate: 0.02, maturityMultiplier: 2 };

    case "36 Months - 2.5%":
      return { months: 36, rate: 0.025, maturityMultiplier: 2 };

    default:
      throw new Error(`Unknown scheme: ${scheme}`);
  }
}

// --------------------------------------------------
// Money Helper
// --------------------------------------------------

function roundMoney(value) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

// --------------------------------------------------
// Amount / Commission Rules
// --------------------------------------------------

export function getActualInvestment(receivedAmount) {
  const amount = Number(receivedAmount) || 0;
  return roundMoney(amount / 1.1);
}

export function getUpfrontCommission(receivedAmount) {
  const amount = Number(receivedAmount) || 0;
  const actualInvestment = getActualInvestment(amount);

  return roundMoney(amount - actualInvestment);
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

  /*
   * Start from the first day of the original month.
   *
   * This prevents JavaScript from overflowing dates such as:
   *
   * 30-01-2025 + 1 month
   *        ↓
   * 30-02-2025
   *        ↓
   * 02-03-2025   ❌
   *
   * Instead, the day is clamped to the last valid day
   * of the target month:
   *
   * 30-01-2025 + 1 month
   *        ↓
   * 28-02-2025   ✅
   */

  const date = new Date(year, month - 1, 1);

  date.setMonth(date.getMonth() + months);

  const targetYear = date.getFullYear();
  const targetMonth = date.getMonth();

  // Last valid day of the target month.
  const lastDayOfTargetMonth = new Date(
    targetYear,
    targetMonth + 1,
    0,
  ).getDate();

  // Keep the original day when possible.
  // Otherwise use the last day of the target month.
  date.setDate(Math.min(day, lastDayOfTargetMonth));

  const resultYear = date.getFullYear();
  const resultMonth = String(date.getMonth() + 1).padStart(2, "0");
  const resultDay = String(date.getDate()).padStart(2, "0");

  return `${resultYear}-${resultMonth}-${resultDay}`;
}

export function formatDate(dateString) {
  if (!dateString) return "";

  const [year, month, day] = String(dateString).split("-").map(Number);

  if (!year || !month || !day) return dateString;

  return `${String(day).padStart(2, "0")}-${String(month).padStart(
    2,
    "0",
  )}-${year}`;
}

// --------------------------------------------------
// Investment Date Rules
// --------------------------------------------------

export function getInvestmentDateCategory(investmentDate) {
  const [, , day] = String(investmentDate).split("-").map(Number);

  // 1st - 15th
  if (day >= 1 && day <= 15) {
    return "NORMAL";
  }

  // 16th - 25th
  if (day >= 16 && day <= 25) {
    return "SPECIAL_2_PERCENT";
  }

  // 26th - 31st
  return "NO_PAYMENT";
}

// Backward-compatible helper.
// Existing routes may still import isAfter15th().
export function isAfter15th(investmentDate) {
  return getInvestmentDateCategory(investmentDate) === "NO_PAYMENT";
}

// --------------------------------------------------
// Effective Tenure
// --------------------------------------------------

export function getEffectiveTenure(investmentDate, scheme) {
  const info = schemeInfo(scheme);

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
  // 26th - 31st
  // No payment in investment month.
  // ------------------------------------------------

  if (monthNo === 1 && dateCategory === "NO_PAYMENT") {
    return {
      amount: 0,
      complimentary: false,
      noPayment: true,
    };
  }

  // ------------------------------------------------
  // 16th - 25th
  // 2% payout only for investment month.
  // ------------------------------------------------

  if (monthNo === 1 && dateCategory === "SPECIAL_2_PERCENT") {
    return {
      amount: roundMoney(actualInvestment * 0.02),
      complimentary: false,
      noPayment: false,
    };
  }

  // ------------------------------------------------
  // Normal selected scheme rate.
  // ------------------------------------------------

  return {
    amount: roundMoney(actualInvestment * info.rate),
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
    amountDue: roundMoney(payout.amount),
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
    .sort({ investorCode: -1 })
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

  const actualInvestment = getActualInvestment(row.amount);

  const upfrontCommission = getUpfrontCommission(row.amount);

  const monthlyPayout = roundMoney(actualInvestment * info.rate);

  const maturityDate = addMonths(row.investmentDate, totalMonths);

  const maturityAmount =
    info.maturityMultiplier === null
      ? 0
      : roundMoney(actualInvestment * info.maturityMultiplier);

  return {
    ...row,

    id: row._id?.toString?.() || row.id,

    completedMonths: effectiveCompletedMonths,

    remainingMonths,

    totalMonths,

    amount: Number(row.amount),

    actualInvestment,

    upfrontCommission,

    monthlyPayout,

    maturityDate,

    maturityAmount,

    initialCommission: upfrontCommission,

    tenureCompleted,

    tenureMessage: tenureCompleted ? "Tenure Completed" : "",
  };
}
