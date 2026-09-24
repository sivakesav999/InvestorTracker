import { useEffect, useState } from "react";
import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from "react-router-dom";

import LoginPage from "./pages/LoginPage.jsx";
import DashboardPage from "./pages/DashboardPage.jsx";
import { getAuth } from "./services/api.js";

function AppRoutes({ auth, setAuth }) {
  const location = useLocation();
  const navigate = useNavigate();

  if (auth.status === "checking") {
    return null;
  }

  function handleLoginSuccess() {
    setAuth((current) => ({
      ...current,
      status: "authenticated",
    }));

    navigate("/", { replace: true });
  }

  function handleLogout() {
    setAuth({
      status: "unauthenticated",
      username: null,
    });

    navigate("/login", { replace: true });
  }

  return (
    <Routes>
      <Route
        path="/login"
        element={
          auth.status === "authenticated" ? (
            <Navigate to="/" replace />
          ) : (
            <LoginPage onLoginSuccess={handleLoginSuccess} />
          )
        }
      />

      <Route
        path="/"
        element={
          auth.status === "authenticated" ? (
            <DashboardPage onLogout={handleLogout} />
          ) : (
            <Navigate to="/login" replace state={{ from: location }} />
          )
        }
      />

      <Route
        path="*"
        element={
          auth.status === "authenticated" ? (
            <Navigate to="/" replace />
          ) : (
            <Navigate to="/login" replace />
          )
        }
      />
    </Routes>
  );
}

export default function App() {
  const [auth, setAuth] = useState({
    status: "checking",
    username: null,
  });

  useEffect(() => {
    let active = true;

    getAuth()
      .then((data) => {
        if (!active) return;

        setAuth({
          status: data.authenticated ? "authenticated" : "unauthenticated",
          username: data.username || null,
        });
      })
      .catch(() => {
        if (!active) return;

        setAuth({
          status: "unauthenticated",
          username: null,
        });
      });

    return () => {
      active = false;
    };
  }, []);

  return (
    <BrowserRouter>
      <AppRoutes auth={auth} setAuth={setAuth} />
    </BrowserRouter>
  );
}
