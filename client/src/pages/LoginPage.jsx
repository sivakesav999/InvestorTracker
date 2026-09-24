import { useState } from "react";
import { login } from "../services/api.js";

export default function LoginPage({ onLoginSuccess }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      await login(username, password);
      onLoginSuccess();
    } catch (err) {
      setError(err.message || "Login failed");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="login-page">
      <div className="login-card">
        <h1>Investment Tracker</h1>
        <p className="muted">Sign in to manage investors and payments.</p>

        <form onSubmit={handleSubmit}>
          <label>
            Username
            <input
              id="username"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              autoComplete="username"
              required
            />
          </label>

          <label>
            Password
            <input
              id="password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
              required
            />
          </label>

          <div className="error">{error}</div>

          <button className="btn primary full" type="submit">
            Sign In
          </button>
        </form>
      </div>
    </main>
  );
}
