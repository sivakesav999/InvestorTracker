import { logout } from "../services/api.js";

export default function DashboardPage({ username, onLogout }) {
  async function handleLogout() {
    try {
      await logout();
    } finally {
      onLogout();
    }
  }

  return (
    <main style={{ padding: "24px" }}>
      <h1>Investment Tracker</h1>
      <p className="muted">Authenticated as {username || "admin"}.</p>
      <button className="btn primary" type="button" onClick={handleLogout}>
        Logout
      </button>
    </main>
  );
}
