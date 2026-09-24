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
  return api("/api/auth", {
    method: "GET",
  });
}

export function login(username, password) {
  return api("/api/login", {
    method: "POST",
    body: JSON.stringify({ username, password }),
  });
}

export function logout() {
  return api("/api/logout", {
    method: "POST",
  });
}
