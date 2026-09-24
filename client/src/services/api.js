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
    throw new Error(data?.error || "Request failed");
  }

  return data;
}

export function getAuth() {
  return api("/api/auth", { method: "GET" });
}

export function login(username, password) {
  return api("/api/login", {
    method: "POST",
    body: JSON.stringify({ username, password }),
  });
}

export function logout() {
  return api("/api/logout", { method: "POST" });
}

export function getSchemes() {
  return api("/api/schemes", { method: "GET" });
}

export function getDashboard() {
  return api("/api/dashboard", { method: "GET" });
}

export function getInvestors(query = "") {
  return api(`/api/investors?q=${encodeURIComponent(query)}`, { method: "GET" });
}

export function getInvestor(id) {
  return api(`/api/investors/${id}`, { method: "GET" });
}

export function saveInvestor(id, body) {
  return api(id ? `/api/investors/${id}` : "/api/investors", {
    method: id ? "PUT" : "POST",
    body: JSON.stringify(body),
  });
}

export function deleteInvestor(id) {
  return api(`/api/investors/${id}`, { method: "DELETE" });
}

export function savePayment(id, body) {
  return api(`/api/payments/${id}`, {
    method: "PUT",
    body: JSON.stringify(body),
  });
}

export function saveAllPayments(payments) {
  return api("/api/payments/bulk", {
    method: "PUT",
    body: JSON.stringify({ payments }),
  });
}
