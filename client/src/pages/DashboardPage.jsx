import { useCallback, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import Header from "../components/Header.jsx";
import DashboardCards from "../components/DashboardCards.jsx";
import SearchBar from "../components/SearchBar.jsx";
import InvestorTable from "../components/InvestorTable.jsx";
import InvestorModal from "../components/InvestorModal.jsx";
import PaymentModal from "../components/PaymentModal.jsx";
import Toast from "../components/Toast.jsx";

import { deleteInvestor, getDashboard, getInvestors } from "../services/api.js";

function AppToast({ value, onClose }) {
  if (!value) return null;

  return <Toast toast={{ ...value, onClose }} />;
}

export default function DashboardPage({ onLogout }) {
  const queryClient = useQueryClient();

  // What the user is currently typing
  const [search, setSearch] = useState("");

  // What has actually been submitted
  const [submittedSearch, setSubmittedSearch] = useState("");

  const [toast, setToast] = useState(null);

  const [investorModal, setInvestorModal] = useState({
    open: false,
    id: null,
  });

  const [paymentModal, setPaymentModal] = useState({
    open: false,
    id: null,
  });

  const showToast = useCallback((message, type = "success") => {
    setToast({
      id: Date.now(),
      message,
      type,
    });
  }, []);

  // =====================================================
  // Dashboard Cache
  // =====================================================

  const {
    data: dashboard = null,
    isLoading: isDashboardLoading,
    isError: isDashboardError,
    error: dashboardError,
  } = useQuery({
    queryKey: ["dashboard"],
    queryFn: getDashboard,
  });

  // =====================================================
  // Investors Cache
  // =====================================================

  const {
    data: investors = [],
    isLoading: isInvestorsLoading,
    isError: isInvestorsError,
    error: investorsError,
  } = useQuery({
    queryKey: ["investors", submittedSearch],
    queryFn: () => getInvestors(submittedSearch),
  });

  const isLoading = isDashboardLoading || isInvestorsLoading;

  // =====================================================
  // Error Handling
  // =====================================================

  if (isDashboardError) {
    console.error(dashboardError);
  }

  if (isInvestorsError) {
    console.error(investorsError);
  }

  // =====================================================
  // Search
  // =====================================================

  function handleSearch() {
    setSubmittedSearch(search.trim());
  }

  function handleClear() {
    setSearch("");
    setSubmittedSearch("");
  }

  // =====================================================
  // Refresh Data
  // =====================================================
  //
  // IMPORTANT:
  //
  // Investor/payment changes can affect:
  //
  // 1. Dashboard
  // 2. Investor list
  // 3. My Earnings
  //
  // "earnings" is used as a prefix so this invalidates:
  //
  // ["earnings"]
  // ["earnings", "", ""]
  // ["earnings", "2026-09-01", "2026-09-26"]
  // etc.
  //
  // =====================================================

  async function refreshData() {
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: ["dashboard"],
      }),

      queryClient.invalidateQueries({
        queryKey: ["investors"],
      }),

      queryClient.invalidateQueries({
        queryKey: ["earnings"],
      }),
    ]);
  }

  // =====================================================
  // Investor Actions
  // =====================================================

  function openNew() {
    setInvestorModal({
      open: true,
      id: null,
    });
  }

  function openEdit(id) {
    if (!id) {
      showToast("Investor ID is missing.", "error");
      return;
    }

    setInvestorModal({
      open: true,
      id,
    });
  }

  function openPayments(id) {
    if (!id) {
      showToast("Investor ID is missing.", "error");
      return;
    }

    setPaymentModal({
      open: true,
      id,
    });
  }

  async function handleDelete(id) {
    if (!id) {
      showToast("Investor ID is missing.", "error");
      return;
    }

    if (!window.confirm("Delete this investor and all payment records?")) {
      return;
    }

    try {
      await deleteInvestor(id);

      await refreshData();

      showToast("Investor deleted successfully.");
    } catch (error) {
      console.error(error);

      showToast(error.message, "error");
    }
  }

  return (
    <>
      <Header onLogout={onLogout} />

      <main>
        <DashboardCards dashboard={dashboard} />

        <SearchBar
          value={search}
          onChange={setSearch}
          onSearch={handleSearch}
          onClear={handleClear}
          onAdd={openNew}
        />

        {isLoading ? (
          <section className="panel">
            <div className="table-wrap">
              <table>
                <tbody>
                  <tr>
                    <td className="muted">Loading investors...</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>
        ) : (
          <InvestorTable
            investors={investors}
            onEdit={openEdit}
            onPayments={openPayments}
            onDelete={handleDelete}
          />
        )}
      </main>

      <InvestorModal
        open={investorModal.open}
        investorId={investorModal.id}
        onClose={() =>
          setInvestorModal({
            open: false,
            id: null,
          })
        }
        onSaved={async () => {
          await refreshData();
        }}
        showToast={showToast}
      />

      <PaymentModal
        open={paymentModal.open}
        investorId={paymentModal.id}
        onClose={() =>
          setPaymentModal({
            open: false,
            id: null,
          })
        }
        onChanged={refreshData}
        showToast={showToast}
      />

      <AppToast value={toast} onClose={() => setToast(null)} />
    </>
  );
}
