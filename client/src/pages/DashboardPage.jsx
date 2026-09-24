import { useCallback, useEffect, useState } from "react";
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
  const [dashboard, setDashboard] = useState(null);
  const [investors, setInvestors] = useState([]);
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [toast, setToast] = useState(null);
  const [investorModal, setInvestorModal] = useState({ open: false, id: null });
  const [paymentModal, setPaymentModal] = useState({ open: false, id: null });

  const showToast = useCallback((message, type = "success") => {
    setToast({ id: Date.now(), message, type });
  }, []);

  const loadDashboard = useCallback(async () => {
    const data = await getDashboard();
    setDashboard(data);
  }, []);

  const loadInvestors = useCallback(async (query = "") => {
    const data = await getInvestors(query);
    setInvestors(data);
  }, []);

  const refreshData = useCallback(async () => {
    await Promise.all([loadDashboard(), loadInvestors(search)]);
  }, [loadDashboard, loadInvestors, search]);

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        setIsLoading(true);
        const [dashboardData, investorData] = await Promise.all([
          getDashboard(),
          getInvestors(""),
        ]);

        if (!active) return;
        setDashboard(dashboardData);
        setInvestors(investorData);
      } catch (error) {
        if (!active) return;
        console.error(error);
        showToast(error.message, "error");
      } finally {
        if (active) setIsLoading(false);
      }
    }

    load();
    return () => {
      active = false;
    };
  }, [showToast]);

  async function handleSearch() {
    try {
      await loadInvestors(search);
    } catch (error) {
      console.error(error);
      showToast(error.message, "error");
    }
  }

  async function handleClear() {
    setSearch("");
    try {
      await loadInvestors("");
    } catch (error) {
      console.error(error);
      showToast(error.message, "error");
    }
  }

  function openNew() {
    setInvestorModal({ open: true, id: null });
  }

  function openEdit(id) {
    if (!id) {
      showToast("Investor ID is missing.", "error");
      return;
    }
    setInvestorModal({ open: true, id });
  }

  function openPayments(id) {
    if (!id) {
      showToast("Investor ID is missing.", "error");
      return;
    }
    setPaymentModal({ open: true, id });
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
        onClose={() => setInvestorModal({ open: false, id: null })}
        onSaved={async () => {
          await refreshData();
        }}
        showToast={showToast}
      />

      <PaymentModal
        open={paymentModal.open}
        investorId={paymentModal.id}
        onClose={() => setPaymentModal({ open: false, id: null })}
        onChanged={refreshData}
        showToast={showToast}
      />

      <AppToast value={toast} onClose={() => setToast(null)} />
    </>
  );
}
