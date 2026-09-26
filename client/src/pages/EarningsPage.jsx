import { useState } from "react";
import { useQuery } from "@tanstack/react-query";

import Header from "../components/Header.jsx";
import { getEarnings } from "../services/api.js";

// --------------------------------------------------
// Helpers
// --------------------------------------------------

function money(value) {
  const number = Number(value || 0);

  return `₹${number.toLocaleString("en-IN", {
    maximumFractionDigits: 2,
  })}`;
}

function getMonthStart() {
  const now = new Date();

  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");

  return `${year}-${month}-01`;
}

function getToday() {
  const now = new Date();

  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function formatDate(value) {
  if (!value) return "";

  const parts = String(value).split("-");

  if (parts.length !== 3) {
    return value;
  }

  return `${parts[2]}-${parts[1]}-${parts[0]}`;
}

// --------------------------------------------------
// Earnings Page
// --------------------------------------------------

export default function EarningsPage({ onLogout }) {
  const [from, setFrom] = useState(getMonthStart);
  const [to, setTo] = useState(getToday);

  // Empty initially = ALL TIME
  const [submitted, setSubmitted] = useState({
    from: "",
    to: "",
  });

  const [filterError, setFilterError] = useState("");

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["earnings", submitted.from, submitted.to],

    queryFn: () => getEarnings(submitted.from, submitted.to),
  });

  // ------------------------------------------------
  // Apply filter
  // ------------------------------------------------

  function handleFilter() {
    setFilterError("");

    if (!from || !to) {
      setFilterError("Please select both From Date and To Date.");

      return;
    }

    if (from > to) {
      setFilterError("From Date cannot be later than To Date.");

      return;
    }

    setSubmitted({
      from,
      to,
    });
  }

  // ------------------------------------------------
  // Clear filter
  // ------------------------------------------------

  function handleClearFilter() {
    setFilterError("");

    setFrom(getMonthStart());
    setTo(getToday());

    setSubmitted({
      from: "",
      to: "",
    });
  }

  const isFiltered = Boolean(submitted.from) || Boolean(submitted.to);

  // ------------------------------------------------
  // Current results
  // ------------------------------------------------

  const initialCommission = Number(data?.initialCommission || 0);

  const monthlyCommission = Number(data?.monthlyCommission || 0);

  const totalEarnings = Number(data?.totalEarnings || 0);

  const investorsCount = Number(data?.investorsCount || 0);

  const paidMonthlyPayments = Number(data?.paidMonthlyPayments || 0);

  // ------------------------------------------------
  // Render
  // ------------------------------------------------

  return (
    <>
      <Header onLogout={onLogout} />

      <main className="earnings-page">
        {/* ==========================================
            PAGE TITLE
        ========================================== */}

        <section className="earnings-title">
          <h2>My Earnings</h2>

          <p>
            {isFiltered
              ? `Earnings from ${formatDate(
                  submitted.from,
                )} to ${formatDate(submitted.to)}`
              : "All Time Earnings"}
          </p>
        </section>

        {/* ==========================================
            MAIN EARNINGS SUMMARY
        ========================================== */}

        {!isLoading && !isError && (
          <>
            <section className="earnings-main-cards">
              {/* Initial Commission */}

              <div className="earnings-card earnings-card-initial">
                <span>Initial Commission</span>

                <strong>{money(initialCommission)}</strong>
              </div>

              {/* Monthly Commission */}

              <div className="earnings-card earnings-card-monthly">
                <span>Monthly Commission</span>

                <strong>{money(monthlyCommission)}</strong>
              </div>

              {/* Total Earnings */}

              <div className="earnings-card earnings-card-total">
                <span>Total Earnings</span>

                <strong>{money(totalEarnings)}</strong>
              </div>
            </section>

            {/* ======================================
                SUPPORTING INFORMATION
            ====================================== */}

            <section className="earnings-info-grid">
              <div className="earnings-info-card earnings-info-investors">
                <span>Investors</span>

                <strong>{investorsCount}</strong>
              </div>

              <div className="earnings-info-card earnings-info-payments">
                <span>Paid Monthly Payments</span>

                <strong>{paidMonthlyPayments}</strong>
              </div>

              <div className="earnings-info-card earnings-info-period">
                <span>Period</span>

                <strong>
                  {isFiltered
                    ? `${formatDate(submitted.from)} → ${formatDate(
                        submitted.to,
                      )}`
                    : "All Time"}
                </strong>
              </div>
            </section>
          </>
        )}

        {/* ==========================================
            FILTER CONTAINER
        ========================================== */}

        <section className="earnings-filter-container">
          <div className="earnings-section-title">
            <h3>Filter Earnings</h3>

            <p>Select a date range to view earnings for that period.</p>
          </div>

          <div className="earnings-filter-form">
            <label>
              <span>From Date</span>

              <input
                type="date"
                value={from}
                onChange={(event) => setFrom(event.target.value)}
              />
            </label>

            <label>
              <span>To Date</span>

              <input
                type="date"
                value={to}
                onChange={(event) => setTo(event.target.value)}
              />
            </label>

            <div className="earnings-filter-buttons">
              <button
                type="button"
                className="btn primary"
                onClick={handleFilter}
              >
                Apply Filter
              </button>

              {isFiltered && (
                <button
                  type="button"
                  className="btn light"
                  onClick={handleClearFilter}
                >
                  Clear Filter
                </button>
              )}
            </div>
          </div>

          {filterError && <div className="form-error">{filterError}</div>}
        </section>

        {/* ==========================================
            FILTER RESULTS
        ========================================== */}

        <section className="earnings-results">
          <div className="earnings-section-title">
            <h3>{isFiltered ? "Filter Results" : "Current Earnings"}</h3>

            <p>
              {isFiltered
                ? `${formatDate(submitted.from)} → ${formatDate(submitted.to)}`
                : "All Time Earnings"}
            </p>
          </div>

          {isLoading && (
            <div className="earnings-loading">Loading earnings...</div>
          )}

          {isError && (
            <div className="error">
              {error?.message || "Failed to load earnings."}
            </div>
          )}

          {!isLoading && !isError && (
            <div className="earnings-result-cards">
              <div className="earnings-result-card result-initial">
                <span>Initial Commission</span>

                <strong>{money(initialCommission)}</strong>
              </div>

              <div className="earnings-result-card result-monthly">
                <span>Monthly Commission</span>

                <strong>{money(monthlyCommission)}</strong>
              </div>

              <div className="earnings-result-card result-total">
                <span>Total Earnings</span>

                <strong>{money(totalEarnings)}</strong>
              </div>
            </div>
          )}
        </section>
      </main>
    </>
  );
}
