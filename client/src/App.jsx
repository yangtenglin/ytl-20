import { useState, useEffect } from 'react';
import { api } from './api.js';
import PatientRegistration from './components/PatientRegistration.jsx';
import QueueDisplay from './components/QueueDisplay.jsx';
import DoctorWorkspace from './components/DoctorWorkspace.jsx';
import StatsBar from './components/StatsBar.jsx';
import Toast from './components/Toast.jsx';

export default function App() {
  const [activeTab, setActiveTab] = useState('registration');
  const [stats, setStats] = useState(null);
  const [toast, setToast] = useState(null);

  const showToast = (message, type = 'info') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const fetchStats = async () => {
    try {
      const data = await api.getStats();
      setStats(data);
    } catch (err) {
      console.error('获取统计数据失败:', err);
    }
  };

  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, 5000);
    return () => clearInterval(interval);
  }, []);

  const tabs = [
    { id: 'registration', label: '病人登记' },
    { id: 'queue', label: '排队候诊' },
    { id: 'doctors', label: '医生工作台' }
  ];

  return (
    <div className="app-container">
      <header className="app-header">
        <h1>
          <span className="icon">🏥</span>
          纸上诊所
        </h1>
        <div className="subtitle">社区义诊排队与分诊系统</div>
      </header>

      <nav className="nav-tabs">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            className={`nav-tab ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      <main className="app-main">
        <StatsBar stats={stats} />

        {activeTab === 'registration' && (
          <PatientRegistration onSuccess={showToast} refreshStats={fetchStats} />
        )}
        {activeTab === 'queue' && <QueueDisplay onSuccess={showToast} refreshStats={fetchStats} />}
        {activeTab === 'doctors' && <DoctorWorkspace onSuccess={showToast} refreshStats={fetchStats} />}
      </main>

      {toast && <Toast message={toast.message} type={toast.type} />}
    </div>
  );
}
