import { useLocation, useNavigate } from "react-router-dom";

export default function Header({ onLogout }) {
  const navigate = useNavigate();
  const location = useLocation();

  const isEarningsPage = location.pathname === "/earnings";

  return (
    <header>
      <div>
        <h1>Investment Tracker</h1>
      </div>

      <div className="header-actions">
        <button
          type="button"
          className="btn light header-btn"
          onClick={() => navigate(isEarningsPage ? "/" : "/earnings")}
        >
          {isEarningsPage ? "Home" : "My Earnings"}
        </button>

        <a className="btn light header-btn export-btn" href="/api/export">
          Export Excel
        </a>

        <button
          type="button"
          className="btn light header-btn"
          onClick={onLogout}
        >
          Logout
        </button>
      </div>
    </header>
  );
}
