export default function StatsBar({ stats }) {
  if (!stats) return null;

  const items = [
    { key: 'waiting', label: '等待中', value: stats.waiting, className: 'waiting' },
    { key: 'consulting', label: '接诊中', value: stats.consulting, className: 'consulting' },
    { key: 'done', label: '已完成', value: stats.done, className: 'done' },
    { key: 'today', label: '今日登记', value: stats.today, className: 'today' },
    { key: 'busy_doctors', label: '忙碌医生', value: stats.busy_doctors, className: 'busy-doctors' },
    { key: 'available_doctors', label: '空闲医生', value: stats.available_doctors, className: 'available-doctors' }
  ];

  return (
    <div className="stats-bar">
      {items.map((item) => (
        <div key={item.key} className={`stat-card ${item.className}`}>
          <div className="stat-label">{item.label}</div>
          <div className="stat-value">{item.value}</div>
        </div>
      ))}
    </div>
  );
}
