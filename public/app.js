const $ = (id) => document.getElementById(id);

let schemes = [];

// ======================================================
// Utility
// ======================================================

const money = (n) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(n || 0);

function esc(s) {
  return String(s ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[c],
  );
}

// ======================================================
// API Helper
// ======================================================

async function api(url, opts = {}) {
  const r = await fetch(url, {
    headers: {
      "Content-Type": "application/json",
      ...(opts.headers || {}),
    },
    ...opts,
  });

  const j = await r.json();

  if (!r.ok) {
    throw Error(j.error || "Request failed");
  }

  return j;
}

// ======================================================
// Logout
// ======================================================

async function logout() {
  try {
    await fetch("/api/logout", {
      method: "POST",
    });
  } finally {
    location.href = "/login.html";
  }
}

// ======================================================
// Initialize
// ======================================================

async function init() {
  try {
    schemes = await api("/api/schemes");

    $("scheme").innerHTML = schemes
      .map(
        (s) =>
          `<option value="${esc(s)}">${esc(s)}</option>`,
      )
      .join("");

    await loadDashboard();
    await loadInvestors();
  } catch (e) {
    console.error(e);

    if (
      e.message.toLowerCase().includes("authentication")
    ) {
      location.href = "/login.html";
      return;
    }

    alert(e.message);
  }
}

// ======================================================
// Dashboard
// ======================================================

async function loadDashboard() {
  const d = await api("/api/dashboard");

  const items = [
    ["Investors", d.investors],
    ["Invested", money(d.invested)],
    ["Paid", money(d.paid)],
    ["Pending", money(d.pending)],
    ["Cash", money(d.cash)],
    ["UPI", money(d.upi)],
  ];

  $("dashboard").innerHTML = items
    .map(
      (x) => `
        <div class="card">
          <span>${x[0]}</span>
          <b>${x[1]}</b>
        </div>
      `,
    )
    .join("");
}

// ======================================================
// Load Investors
// ======================================================

async function loadInvestors() {
  try {
    const q = encodeURIComponent(
      $("search").value || "",
    );

    const data = await api(
      "/api/investors?q=" + q,
    );

    $("investors").innerHTML =
      data
        .map(
          (i) => `
            <tr>

              <td>
                ${esc(i.investorCode || "-")}
              </td>

              <td>
                <b>${esc(i.name || "-")}</b>
              </td>

              <td>
                ${esc(i.phone || "-")}
              </td>

              <td>
                ${money(i.amount)}
              </td>

              <td>
                ${esc(i.scheme || "-")}
              </td>

              <td>
                ${money(i.monthlyPayout)}
              </td>

              <td>
                ${i.monthsRemaining ?? "-"}
              </td>

              <td>
                ${money(i.maturityAmount)}
                <br>
                <small>
                  ${esc(i.maturityDate || "-")}
                </small>
              </td>

              <td class="actions">

                <button
                  class="btn small"
                  onclick="editInvestor('${i.id}')"
                >
                  Edit
                </button>

                <button
                  class="btn small"
                  onclick="showPayments('${i.id}')"
                >
                  Payments
                </button>

                <button
                  class="btn small"
                  onclick="removeInvestor('${i.id}')"
                >
                  Delete
                </button>

              </td>

            </tr>
          `,
        )
        .join("") ||
      `
        <tr>
          <td colspan="9" class="muted">
            No investors found.
          </td>
        </tr>
      `;
  } catch (e) {
    console.error(e);
    alert(e.message);
  }
}

// ======================================================
// Add Investor
// ======================================================

function openNew() {
  $("modalTitle").textContent = "Add Investor";

  // Empty ID = create new investor
  $("id").value = "";

  $("name").value = "";
  $("phone").value = "";
  $("address").value = "";
  $("notes").value = "";

  $("investment_date").value =
    new Date().toISOString().slice(0, 10);

  $("amount").value = "";

  if (schemes.length > 0) {
    $("scheme").selectedIndex = 0;
  }

  $("modal").style.display = "flex";
}

// ======================================================
// Close Investor Modal
// ======================================================

function closeModal() {
  $("modal").style.display = "none";
}

// ======================================================
// Edit Investor
// ======================================================

async function editInvestor(id) {
  try {
    if (!id) {
      alert("Investor ID is missing.");
      return;
    }

    const x = await api(
      "/api/investors/" + id,
    );

    const i = x.investor;

    $("modalTitle").textContent =
      "Edit " + (i.investorCode || "Investor");

    // IMPORTANT:
    // Backend returns `id`, not `_id`
    $("id").value = i.id;

    $("name").value = i.name || "";

    $("phone").value = i.phone || "";

    $("address").value = i.address || "";

    $("investment_date").value =
      i.investmentDate || "";

    $("amount").value =
      i.amount ?? "";

    $("scheme").value =
      i.scheme || "";

    $("notes").value =
      i.notes || "";

    $("modal").style.display = "flex";
  } catch (e) {
    console.error(e);
    alert(e.message);
  }
}

// ======================================================
// Save Investor
// ======================================================

$("investorForm").onsubmit = async (e) => {
  e.preventDefault();

  const body = {
    name: $("name").value.trim(),

    phone: $("phone").value.trim(),

    address: $("address").value.trim(),

    investment_date:
      $("investment_date").value,

    amount: $("amount").value,

    scheme: $("scheme").value,

    notes: $("notes").value.trim(),
  };

  // Validation
  if (!body.name) {
    alert("Please enter investor name.");
    $("name").focus();
    return;
  }

  if (
    !body.amount ||
    Number(body.amount) <= 0
  ) {
    alert("Please enter a valid investment amount.");
    $("amount").focus();
    return;
  }

  if (!body.investment_date) {
    alert("Please select investment date.");
    $("investment_date").focus();
    return;
  }

  if (!body.scheme) {
    alert("Please select a scheme.");
    $("scheme").focus();
    return;
  }

  try {
    const id = $("id").value;

    // ============================================
    // CREATE
    // ============================================

    if (!id) {
      await api("/api/investors", {
        method: "POST",
        body: JSON.stringify(body),
      });
    }

    // ============================================
    // UPDATE
    // ============================================

    else {
      await api(
        "/api/investors/" + id,
        {
          method: "PUT",
          body: JSON.stringify(body),
        },
      );
    }

    closeModal();

    await loadDashboard();
    await loadInvestors();

    alert(
      id
        ? "Investor updated successfully."
        : "Investor added successfully.",
    );
  } catch (e) {
    console.error(e);
    alert(e.message);
  }
};

// ======================================================
// Delete Investor
// ======================================================

async function removeInvestor(id) {
  if (!id) {
    alert("Investor ID is missing.");
    return;
  }

  const confirmed = confirm(
    "Delete this investor and all payment records?",
  );

  if (!confirmed) {
    return;
  }

  try {
    await api(
      "/api/investors/" + id,
      {
        method: "DELETE",
      },
    );

    await loadDashboard();
    await loadInvestors();

    alert(
      "Investor deleted successfully.",
    );
  } catch (e) {
    console.error(e);
    alert(e.message);
  }
}

// ======================================================
// Show Payments
// ======================================================

async function showPayments(id) {
  try {
    if (!id) {
      alert("Investor ID is missing.");
      return;
    }

    const x = await api(
      "/api/investors/" + id,
    );

    const i = x.investor;

    $("paymentTitle").textContent =
      `Payments • ${i.investorCode} • ${i.name}`;

    $("paymentSummary").innerHTML = `
      <p>
        <b>${esc(i.scheme)}</b>
        &nbsp;
        Investment: ${money(i.amount)}
        &nbsp;
        Monthly: ${money(i.monthlyPayout)}
        &nbsp;
        Remaining: ${i.monthsRemaining}
      </p>
      <br>
    `;

    $("payments").innerHTML =
      x.payments
        .map(
          (p) => `
            <tr>

              <td>
                ${p.monthNo}
              </td>

              <td>
                ${esc(p.dueDate || "-")}
              </td>

              <td>
                ${money(p.amountDue)}
              </td>

              <td>
                <input
                  type="number"
                  min="0"
                  value="${p.amountPaid || 0}"
                  id="paid-${p._id}"
                >
              </td>

              <td>
                <input
                  type="date"
                  value="${p.paymentDate || ""}"
                  id="date-${p._id}"
                >
              </td>

              <td>
                <select
                  id="method-${p._id}"
                >

                  <option value="">
                    --
                  </option>

                  <option
                    value="Cash"
                    ${
                      p.method === "Cash"
                        ? "selected"
                        : ""
                    }
                  >
                    Cash
                  </option>

                  <option
                    value="UPI"
                    ${
                      p.method === "UPI"
                        ? "selected"
                        : ""
                    }
                  >
                    UPI
                  </option>

                </select>
              </td>

              <td>
                <input
                  value="${esc(p.notes || "")}"
                  id="note-${p._id}"
                >
              </td>

              <td>

                <button
                  class="btn small"
                  onclick="savePayment('${p._id}')"
                >
                  Save
                </button>

              </td>

            </tr>
          `,
        )
        .join("") ||
      `
        <tr>
          <td
            colspan="8"
            class="muted"
          >
            No payment records found.
          </td>
        </tr>
      `;

    $("paymentsModal").style.display =
      "flex";
  } catch (e) {
    console.error(e);
    alert(e.message);
  }
}

// ======================================================
// Close Payments
// ======================================================

function closePayments() {
  $("paymentsModal").style.display =
    "none";
}

// ======================================================
// Save Payment
// ======================================================

async function savePayment(id) {
  try {
    if (!id) {
      alert("Payment ID is missing.");
      return;
    }

    const amountPaid =
      Number($("paid-" + id).value) || 0;

    const paymentDate =
      $("date-" + id).value;

    const method =
      $("method-" + id).value;

    const notes =
      $("note-" + id).value;

    await api(
      "/api/payments/" + id,
      {
        method: "PUT",

        body: JSON.stringify({
          amount_paid: amountPaid,
          payment_date: paymentDate,
          method: method,
          notes: notes
        })
      }
    );

    // ------------------------------------------
    // Close payment modal immediately
    // ------------------------------------------

    closePayments();

    // ------------------------------------------
    // Refresh dashboard
    // ------------------------------------------

    await loadDashboard();

    // ------------------------------------------
    // Refresh investor table
    // ------------------------------------------

    await loadInvestors();

  } catch (e) {
    console.error(e);

    alert(e.message);
  }
}

// ======================================================
// Search
// ======================================================

$("search").addEventListener(
  "keydown",
  (e) => {
    if (e.key === "Enter") {
      loadInvestors();
    }
  },
);

// ======================================================
// Start
// ======================================================

init();