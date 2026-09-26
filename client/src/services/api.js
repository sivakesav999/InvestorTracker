const JSON_HEADERS = {
  "Content-Type": "application/json",
};

export async function api(url, options = {}) {
  const response = await fetch(url, {
    credentials: "include",
    ...options,
    headers: {
      ...JSON_HEADERS,
      ...(options.headers || {}),
    },
  });

  let data = null;

  try {
    data = await response.json();
  } catch {
    data = null;
  }

  if (!response.ok) {
    throw new Error(
      data?.error || `Request failed with status ${response.status}`,
    );
  }

  return data;
}

/* --------------------------------------------------
   Authentication
-------------------------------------------------- */

export function getAuth() {
  return api("/api/auth", {
    method: "GET",
  });
}

export function login(username, password) {
  return api("/api/login", {
    method: "POST",
    body: JSON.stringify({
      username,
      password,
    }),
  });
}

export function logout() {
  return api("/api/logout", {
    method: "POST",
  });
}

/* --------------------------------------------------
   Dashboard / Schemes
-------------------------------------------------- */

export function getSchemes() {
  return api("/api/schemes", {
    method: "GET",
  });
}

export function getDashboard() {
  return api("/api/dashboard", {
    method: "GET",
  });
}

/* --------------------------------------------------
   Investors
-------------------------------------------------- */

export function getInvestors(query = "") {
  return api(`/api/investors?q=${encodeURIComponent(query)}`, {
    method: "GET",
  });
}

export function getInvestor(id) {
  return api(`/api/investors/${id}`, {
    method: "GET",
  });
}

export function saveInvestor(id, body) {
  return api(id ? `/api/investors/${id}` : "/api/investors", {
    method: id ? "PUT" : "POST",
    body: JSON.stringify(body),
  });
}

/*
  Compatibility helpers.
  These use the same backend endpoints as saveInvestor().
*/

export function createInvestor(body) {
  return saveInvestor(null, body);
}

export function updateInvestor(id, body) {
  return saveInvestor(id, body);
}

export function deleteInvestor(id) {
  return api(`/api/investors/${id}`, {
    method: "DELETE",
  });
}

/* --------------------------------------------------
   Payments
-------------------------------------------------- */

export function savePayment(id, body) {
  return api(`/api/payments/${id}`, {
    method: "PUT",
    body: JSON.stringify({
      amount_paid: Number(body.amount_paid) || 0,
      payment_date: body.payment_date || "",
      method: body.method || "",
      notes: body.notes || "",
    }),
  });
}

export function saveAllPayments(payments) {
  return api("/api/payments/bulk", {
    method: "PUT",
    body: JSON.stringify({
      payments: payments.map((payment) => ({
        id: payment.id,
        amount_paid: Number(payment.amount_paid) || 0,
        payment_date: payment.payment_date || "",
        method: payment.method || "",
        notes: payment.notes || "",
      })),
    }),
  });
}

/*
  Compatibility helpers.
*/

export function updatePayment(id, body) {
  return savePayment(id, body);
}

export function updatePaymentsBulk(payments) {
  return saveAllPayments(payments);
}

/*
  Payment modal loads the investor and its payment records
  through the investor endpoint.
*/

export function getPayments(investorId) {
  return getInvestor(investorId);
}

/* --------------------------------------------------
   Earnings
-------------------------------------------------- */

export function getEarnings(from = "", to = "") {
  const params = new URLSearchParams();

  if (from) {
    params.set("from", from);
  }

  if (to) {
    params.set("to", to);
  }

  const query = params.toString();

  return api(query ? `/api/earnings?${query}` : "/api/earnings", {
    method: "GET",
  });
}
