import Payment from "../models/Payment.js";

// --------------------------------------------------
// Schemes
// --------------------------------------------------

export const schemes = {
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
// Scheme Info
// --------------------------------------------------

export function schemeInfo(scheme) {
  if (!schemes[scheme]) {
    throw new Error("Invalid scheme");
  }

  return schemes[scheme];
}

// --------------------------------------------------
// Add Months
// --------------------------------------------------

export function addMonths(dateString, months) {
  const d = new Date(dateString + "T00:00:00");

  d.setMonth(d.getMonth() + months);

  return d.toISOString().slice(0, 10);
}

// --------------------------------------------------
// Months Completed
// --------------------------------------------------

export function monthsCompleted(start) {
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

export async function nextInvestorCode(Investor) {
  const latest = await Investor.findOne()
    .sort({
      createdAt: -1,
    })
    .lean();

  const n = latest?.investorCode?.match(/(\d+)$/)?.[1];

  return "INV-" + String((Number(n) || 0) + 1).padStart(4, "0");
}

// --------------------------------------------------
// Create Monthly Payment Schedule
// --------------------------------------------------

export async function createPayments(investor) {
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
// Investor View
// --------------------------------------------------

export async function investorView(row) {
  const info = schemeInfo(row.scheme);

  const monthly = row.amount * info.rate;

  const maturity = row.amount * info.maturityMultiplier;

  // Get all payment records for this investor
  const payments = await Payment.find({
    investorId: row._id,
  })
    .sort({
      monthNo: 1,
    })
    .lean();

  // A month is considered COMPLETED only when
  // the full amount due has been paid.
  const completed = payments.filter(
    (p) => Number(p.amountPaid || 0) >= Number(p.amountDue || 0),
  ).length;

  const completedMonths = Math.min(info.months, completed);

  const remainingMonths = Math.max(0, info.months - completedMonths);

  // Total amount actually paid
  const totalPaid = payments.reduce(
    (sum, p) => sum + Number(p.amountPaid || 0),
    0,
  );

  // Total amount still pending from monthly payouts
  const totalDue = payments.reduce(
    (sum, p) =>
      sum + Math.max(0, Number(p.amountDue || 0) - Number(p.amountPaid || 0)),
    0,
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

    maturityDate: addMonths(row.investmentDate, info.months),

    monthsCompleted: completedMonths,

    monthsRemaining: remainingMonths,

    totalPaid,

    totalDue,

    status: completedMonths >= info.months ? "Matured" : "Active",
  };
}
