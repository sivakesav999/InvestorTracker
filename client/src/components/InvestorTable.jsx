import { useMemo } from "react";

function money(value) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Number(value) || 0);
}

function formatDate(value) {
  if (!value) return "-";

  const [year, month, day] = String(value).split("-");

  if (!year || !month || !day) {
    return value;
  }

  return `${day}-${month}-${year}`;
}

export default function InvestorTable({
  investors = [],
  onEdit,
  onDelete,
  onPayments,
}) {
  const rows = useMemo(() => investors, [investors]);

  if (!rows.length) {
    return <div className="empty">No investors found.</div>;
  }

  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Investor ID</th>
            <th>Name</th>
            <th>Phone</th>
            <th>Investment Date</th>
            <th>Amount</th>
            <th>Scheme</th>
            <th>Monthly Payout</th>
            <th>Completed</th>
            <th>Remaining</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>

        <tbody>
          {rows.map((investor) => {
            const completed = Boolean(investor.tenureCompleted);

            const investorId = investor.id || investor._id || null;

            return (
              <tr
                key={investorId || investor.investorCode}
                className={completed ? "investor-row-completed" : ""}
              >
                <td>
                  <strong>{investor.investorCode || "-"}</strong>
                </td>

                <td>
                  <strong>{investor.name}</strong>

                  {completed && (
                    <span className="completed-message">Tenure Completed</span>
                  )}
                </td>

                <td>{investor.phone || "-"}</td>

                <td>{formatDate(investor.investmentDate)}</td>

                <td>{money(investor.amount)}</td>

                <td>{investor.scheme}</td>

                <td>{money(investor.monthlyPayout)}</td>

                <td>
                  {investor.completedMonths ?? 0}
                  {" / "}
                  {investor.totalMonths ?? 0}
                </td>

                <td>{investor.remainingMonths ?? 0}</td>

                <td>
                  {completed ? (
                    <span className="status completed">Tenure Completed</span>
                  ) : (
                    <span className="status active">Active</span>
                  )}
                </td>

                <td>
                  <div className="table-actions investor-actions">
                    <button
                      type="button"
                      className="btn payments-btn"
                      onClick={() => onPayments(investorId)}
                    >
                      Payments
                    </button>

                    <button
                      type="button"
                      className="btn edit-btn"
                      onClick={() => onEdit(investorId)}
                    >
                      Edit
                    </button>

                    <button
                      type="button"
                      className="btn delete-btn"
                      onClick={() => onDelete(investorId)}
                    >
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
