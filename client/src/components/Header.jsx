import { logout } from "../services/api.js";

export default function Header({ onLogout }) {
  async function handleLogout() {
    try {
      await logout();
    } finally {
      onLogout();
    }
  }

  return (
    <header>
      <div>
        <h1>Investment Tracker</h1>
      </div>

      <div className="header-actions">
        <a className="btn light" href="/api/export">
          Export Excel
        </a>

        <button className="btn light" type="button" onClick={handleLogout}>
          Logout
        </button>
      </div>
    </header>
  );
}
