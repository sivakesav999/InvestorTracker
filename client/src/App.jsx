import { useEffect, useRef, useState } from "react";
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

function HomeBackGuard({ enabled }) {
  const restoringHistory = useRef(false);

  useEffect(() => {
    if (!enabled) {
      return undefined;
    }

    /*
     * Create TWO Home entries.
     *
     * We need two entries because if there were only one,
     * pressing Back could leave the React document entirely
     * before popstate had a chance to handle it.
     *
     * React StrictMode runs effects twice in development.
     * Checking the history state prevents duplicate entries.
     */
    const currentState = window.history.state || {};

    if (currentState.investmentTrackerHomeGuard !== 2) {
      const baseState = {
        ...currentState,
        investmentTrackerHomeGuard: true,
      };

      window.history.pushState(
        {
          ...baseState,
          investmentTrackerHomeGuard: 1,
        },
        "",
        window.location.href,
      );

      window.history.pushState(
        {
          ...baseState,
          investmentTrackerHomeGuard: 2,
        },
        "",
        window.location.href,
      );
    }

    function handlePopState() {
      /*
       * The first Back moves from Home Guard #2
       * to Home Guard #1.
       *
       * Move forward again to Home Guard #2.
       */
      if (restoringHistory.current) {
        restoringHistory.current = false;
        return;
      }

      restoringHistory.current = true;

      window.history.forward();
    }

    window.addEventListener("popstate", handlePopState);

    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  }, [enabled]);

  return null;
}

function AppRoutes({ auth, setAuth }) {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (auth.status === "checking") {
      return undefined;
    }

    return undefined;
  }, [auth.status]);

  if (auth.status === "checking") {
    return null;
  }

  function handleLoginSuccess() {
    setAuth({
      status: "authenticated",
      username: auth.username,
    });

    navigate("/", {
      replace: true,
    });
  }

  function handleLogout() {
    setAuth({
      status: "unauthenticated",
      username: null,
    });

    navigate("/login", {
      replace: true,
    });
  }

  const isAuthenticatedHome =
    auth.status === "authenticated" && location.pathname === "/";

  return (
    <>
      <HomeBackGuard enabled={isAuthenticatedHome} />

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
    </>
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
        if (!active) {
          return;
        }

        setAuth({
          status: data.authenticated ? "authenticated" : "unauthenticated",
          username: data.username || null,
        });
      })
      .catch(() => {
        if (!active) {
          return;
        }

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