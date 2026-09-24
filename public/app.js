const $ = (id) => document.getElementById(id);

let schemes = [];
let currentPaymentIds = [];

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
// Toastify
// ======================================================

function toast(message, type = "success") {
  if (typeof Toastify !== "function") {
    console.log(message);
    return;
  }

  Toastify({
    text: message,
    duration: 3000,
    close: true,
    gravity: "top",
    position: "right",
    stopOnFocus: true,
    style: {
      background: type === "error" ? "#b42318" : "#1769aa",
      borderRadius: "8px",
    },
  }).showToast();
}

// ======================================================
// Phone Validation
// ======================================================

function sanitizePhoneInput(input) {
  input.value = input.value.replace(/\D/g, "").slice(0, 10);
}

function validatePhone(phone) {
  return phone === "" || /^\d{10}$/.test(phone);
}

// ======================================================
// Prevent Number Changes With Mouse Wheel
// ======================================================

function preventNumberWheel(event) {
  if (document.activeElement === event.target) {
    event.preventDefault();
  }
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
      .map((s) => `<option value="${esc(s)}">${esc(s)}</option>`)
      .join("");

    await loadDashboard();
    await loadInvestors();
  } catch (e) {
    console.error(e);

    if (e.message.toLowerCase().includes("authentication")) {
      location.href = "/login.html";
      return;
    }

    toast(e.message, "error");
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
    const q = encodeURIComponent($("search").value || "");

    const data = await api("/api/investors?q=" + q);

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
    toast(e.message, "error");
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

  $("investment_date").value = new Date().toISOString().slice(0, 10);

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
      toast("Investor ID is missing.", "error");
      return;
    }

    const x = await api("/api/investors/" + id);

    const i = x.investor;

    $("modalTitle").textContent = "Edit " + (i.investorCode || "Investor");

    // Backend returns `id`, not `_id`
    $("id").value = i.id;

    $("name").value = i.name || "";

    $("phone").value = i.phone || "";

    $("address").value = i.address || "";

    $("investment_date").value = i.investmentDate || "";

    $("amount").value = i.amount ?? "";

    $("scheme").value = i.scheme || "";

    $("notes").value = i.notes || "";

    $("modal").style.display = "flex";
  } catch (e) {
    console.error(e);
    toast(e.message, "error");
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

    investment_date: $("investment_date").value,

    amount: $("amount").value,

    scheme: $("scheme").value,

    notes: $("notes").value.trim(),
  };

  // Validation
  if (!body.name) {
    toast("Please enter investor name.", "error");
    $("name").focus();
    return;
  }

  if (!validatePhone(body.phone)) {
    toast("Phone number must contain exactly 10 digits.", "error");
    $("phone").focus();
    return;
  }

  if (!body.amount || Number(body.amount) <= 0) {
    toast("Please enter a valid investment amount.", "error");
    $("amount").focus();
    return;
  }

  if (!body.investment_date) {
    toast("Please select investment date.", "error");
    $("investment_date").focus();
    return;
  }

  if (!body.scheme) {
    toast("Please select a scheme.", "error");
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
      await api("/api/investors/" + id, {
        method: "PUT",
        body: JSON.stringify(body),
      });
    }

    closeModal();

    await loadDashboard();
    await loadInvestors();

    toast(
      id ? "Investor updated successfully." : "Investor added successfully.",
    );
  } catch (e) {
    console.error(e);
    toast(e.message, "error");
  }
};

// ======================================================
// Delete Investor
// ======================================================

async function removeInvestor(id) {
  if (!id) {
    toast("Investor ID is missing.", "error");
    return;
  }

  const confirmed = confirm("Delete this investor and all payment records?");

  if (!confirmed) {
    return;
  }

  try {
    await api("/api/investors/" + id, {
      method: "DELETE",
    });

    await loadDashboard();
    await loadInvestors();

    toast("Investor deleted successfully.");
  } catch (e) {
    console.error(e);
    toast(e.message, "error");
  }
}

// ======================================================
// Show Payments
// ======================================================

async function showPayments(id) {
  try {
    if (!id) {
      toast("Investor ID is missing.", "error");
      return;
    }

    const x = await api("/api/investors/" + id);

    const i = x.investor;

    // Store payment IDs for Save All
    currentPaymentIds = x.payments.map((p) => String(p._id));

    $("paymentTitle").textContent = `Payments • ${i.investorCode} • ${i.name}`;

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
                    ${p.method === "Cash" ? "selected" : ""}
                  >
                    Cash
                  </option>

                  <option
                    value="UPI"
                    ${p.method === "UPI" ? "selected" : ""}
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

    $("paymentsModal").style.display = "flex";
  } catch (e) {
    console.error(e);
    toast(e.message, "error");
  }
}

// ======================================================
// Close Payments
// ======================================================

function closePayments() {
  $("paymentsModal").style.display = "none";

  currentPaymentIds = [];
}

// ======================================================
// Save Individual Payment
// ======================================================

async function savePayment(id) {
  try {
    if (!id) {
      toast("Payment ID is missing.", "error");
      return;
    }

    const amountPaid = Number($("paid-" + id).value) || 0;

    const paymentDate = $("date-" + id).value;

    const method = $("method-" + id).value;

    const notes = $("note-" + id).value;

    await api("/api/payments/" + id, {
      method: "PUT",

      body: JSON.stringify({
        amount_paid: amountPaid,
        payment_date: paymentDate,
        method: method,
        notes: notes,
      }),
    });

    // Keep payment modal open
    await loadDashboard();
    await loadInvestors();

    toast("Payment saved successfully.");
  } catch (e) {
    console.error(e);

    toast(e.message, "error");
  }
}

// ======================================================
// Save All Payments
// ======================================================

async function saveAllPayments() {
  try {
    if (!currentPaymentIds.length) {
      toast("No payment records to save.", "error");
      return;
    }

    const payments = currentPaymentIds.map((id) => ({
      id,

      amount_paid: Number($("paid-" + id).value) || 0,

      payment_date: $("date-" + id).value,

      method: $("method-" + id).value,

      notes: $("note-" + id).value,
    }));

    // Validate payment methods before sending
    const invalidMethod = payments.find(
      (p) => !["", "Cash", "UPI"].includes(p.method),
    );

    if (invalidMethod) {
      toast("Payment method must be Cash or UPI.", "error");
      return;
    }

    const button = $("saveAllPaymentsBtn");

    const originalText = button.textContent;

    button.disabled = true;
    button.textContent = "Saving...";

    try {
      await api("/api/payments/bulk", {
        method: "PUT",
        body: JSON.stringify({
          payments,
        }),
      });

      await loadDashboard();
      await loadInvestors();

      toast(`${payments.length} payment entries saved successfully.`);
    } finally {
      button.disabled = false;
      button.textContent = originalText;
    }
  } catch (e) {
    console.error(e);
    toast(e.message, "error");
  }
}

// ======================================================
// Search
// ======================================================

function updateSearchClear() {
  const search = $("search");

  const clearButton = $("clearSearch");

  if (!search || !clearButton) {
    return;
  }

  clearButton.style.display = search.value.trim() ? "block" : "none";
}

function clearSearch() {
  $("search").value = "";

  updateSearchClear();

  loadInvestors();

  $("search").focus();
}

$("search").addEventListener("input", () => {
  updateSearchClear();
});

$("search").addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    loadInvestors();
  }

  if (e.key === "Escape") {
    clearSearch();
  }
});

// ======================================================
// Phone Input
// ======================================================

$("phone").addEventListener("input", function () {
  sanitizePhoneInput(this);
});

// ======================================================
// Prevent Amount Mouse Wheel Changes
// ======================================================

$("amount").addEventListener("wheel", preventNumberWheel, { passive: false });

// Payment amount inputs are created dynamically,
// so use event delegation.
document.addEventListener(
  "wheel",
  (event) => {
    if (event.target.matches('input[type="number"]')) {
      preventNumberWheel(event);
    }
  },
  { passive: false },
);

// ======================================================
// Start
// ======================================================

init();
