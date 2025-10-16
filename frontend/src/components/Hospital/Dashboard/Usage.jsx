"use client";

const UsageAlerts = () => {
  const alerts = [
    {
      id: 1,
      title: "Doctor Slots",
      status: "Current",
      description: "7 doctor slots remaining in your current plan",
      icon: (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="lucide lucide-triangle-alert h-5 w-5 text-amber-600"
          aria-hidden="true"
        >
          <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"></path>
          <path d="M12 9v4"></path>
          <path d="M12 17h.01"></path>
        </svg>
      ),
      bgColor: "bg-amber-100",
      buttonText: "Upgrade Plan →",
      onClick: () => console.log("Upgrade Plan clicked")
    },
    {
      id: 2,
      title: "Subscription Renewal",
      status: "Upcoming",
      description: "Your Pro plan subscription renews in 12 days",
      icon: (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="lucide lucide-activity h-5 w-5 text-sky-600"
          aria-hidden="true"
        >
          <path d="M22 12h-2.48a2 2 0 0 0-1.93 1.46l-2.35 8.36a.25.25 0 0 1-.48 0L9.24 2.18a.25.25 0 0 0-.48 0l-2.35 8.36A2 2 0 0 1 4.49 12H2"></path>
        </svg>
      ),
      bgColor: "bg-sky-100",
      buttonText: "View Billing →",
      onClick: () => console.log("View Billing clicked")
    },
    {
      id: 3,
      title: "System Status",
      status: "Live",
      description: "All AI doctor avatars are operational and responding normally",
      icon: (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="lucide lucide-circle-check-big h-5 w-5 text-teal-600"
          aria-hidden="true"
        >
          <path d="M21.801 10A10 10 0 1 1 17 3.335"></path>
          <path d="m9 11 3 3L22 4"></path>
        </svg>
      ),
      bgColor: "bg-teal-100",
      buttonText: "View Details →",
      onClick: () => console.log("View Details clicked")
    }
  ];

  return (
    <div>
      <h2 className="text-xl font-semibold text-slate-900 mb-4">Usage Alerts</h2>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {alerts.map((alert) => (
          <div
            key={alert.id}
            className="bg-white rounded-xl shadow-sm border border-stone-200 p-6"
          >
            <div className="flex items-start space-x-3">
              <div className="flex-shrink-0">
                <div className={`w-8 h-8 ${alert.bgColor} rounded-full flex items-center justify-center`}>
                  {alert.icon}
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <h3 className="text-sm font-medium text-slate-900">{alert.title}</h3>
                  <span className="text-xs text-slate-500">{alert.status}</span>
                </div>
                <p className="text-sm text-slate-600 mb-3">{alert.description}</p>
                <button
                  onClick={alert.onClick}
                  className="text-xs text-teal-600 hover:text-teal-700 font-medium"
                >
                  {alert.buttonText}
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default UsageAlerts;