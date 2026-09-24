function money(value) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value || 0);
}

export default function InvestorTable({ investors, onEdit, onPayments, onDelete }) {
  return (
    <section className="panel">
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Investor</th>
              <th>Phone</th>
              <th>Investment</th>
              <th>Scheme</th>
              <th>Monthly</th>
              <th>Months Left</th>
              <th>Maturity</th>
              <th>Actions</th>
            </tr>
          </thead>

          <tbody>
            {investors.length > 0 ? (
              investors.map((investor) => (
                <tr key={investor.id}>
                  <td>{investor.investorCode || "-"}</td>
                  <td><b>{investor.name || "-"}</b></td>
                  <td>{investor.phone || "-"}</td>
                  <td>{money(investor.amount)}</td>
                  <td>{investor.scheme || "-"}</td>
                  <td>{money(investor.monthlyPayout)}</td>
                  <td>{investor.monthsRemaining ?? "-"}</td>
                  <td>
                    {money(investor.maturityAmount)}
                    <br />
                    <small>{investor.maturityDate || "-"}</small>
                  </td>
                  <td className="actions">
                    <button className="btn small" type="button" onClick={() => onEdit(investor.id)}>
                      Edit
                    </button>
                    <button className="btn small" type="button" onClick={() => onPayments(investor.id)}>
                      Payments
                    </button>
                    <button className="btn small" type="button" onClick={() => onDelete(investor.id)}>
                      Delete
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="9" className="muted">No investors found.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
