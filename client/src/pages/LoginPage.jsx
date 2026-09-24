export default function LoginPage() {
  return (
    <main className="login-page">
      <div className="login-card">
        <h1>Investment Tracker</h1>
        <p className="muted">Sign in to manage investors and payments.</p>

        <form>
          <label>
            Username
            <input id="username" autoComplete="username" required />
          </label>

          <label>
            Password
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              required
            />
          </label>

          <div id="error" className="error"></div>

          <button className="btn primary full" type="submit">
            Sign In
          </button>
        </form>
      </div>
    </main>
  );
}
