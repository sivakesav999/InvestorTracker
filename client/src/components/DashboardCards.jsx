function money(value) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value || 0);
}

export default function DashboardCards({ dashboard }) {
  const items = [
    ["Investors", dashboard?.investors ?? 0],
    ["Invested", money(dashboard?.invested)],
    ["Paid", money(dashboard?.paid)],
    ["Pending", money(dashboard?.pending)],
    ["Cash", money(dashboard?.cash)],
    ["UPI", money(dashboard?.upi)],
  ];

  return (
    <section className="cards" id="dashboard">
      {items.map(([label, value]) => (
        <div className="card" key={label}>
          <span>{label}</span>
          <b>{value}</b>
        </div>
      ))}
    </section>
  );
}
