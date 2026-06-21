import { useState, useEffect } from 'react';
import { api } from '../api.js';

function getPriorityClass(patient) {
  if (patient.is_elderly || patient.priority_score >= 60) return 'priority-high';
  if (patient.priority_score >= 30) return 'priority-mid';
  return '';
}

export default function QueueDisplay({ onSuccess, refreshStats }) {
  const [queue, setQueue] = useState([]);
  const [symptoms, setSymptoms] = useState([]);
  const [loading, setLoading] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const [queueData, symptomsData] = await Promise.all([
        api.getQueue(),
        api.getSymptoms()
      ]);
      setQueue(queueData);
      setSymptoms(symptomsData);
    } catch (err) {
      console.error('加载排队数据失败:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 3000);
    return () => clearInterval(interval);
  }, []);

  const handleCancel = async (patientId) => {
    if (!confirm('确定要取消该病人的排队吗？')) return;
    try {
      await api.cancelPatient(patientId);
      onSuccess('已取消排队', 'success');
      loadData();
      refreshStats();
    } catch (err) {
      onSuccess('取消失败: ' + err.message, 'error');
    }
  };

  const getSymptomName = (id) => {
    const s = symptoms.find((sym) => sym.id === id);
    return s ? s.name : '';
  };

  const getSymptomInfo = (id) => {
    return symptoms.find((sym) => sym.id === id);
  };

  return (
    <div className="content-grid">
      <div className="panel">
        <div className="panel-header">
          <h2>🚶 候诊队列</h2>
          <button className="refresh-btn" onClick={loadData}>
            🔄 刷新
          </button>
        </div>
        <div className="panel-body">
          <div className="queue-legend">
            <div className="legend-item">
              <div className="legend-bar high"></div>
              <span>高危/老人优先</span>
            </div>
            <div className="legend-item">
              <div className="legend-bar mid"></div>
              <span>较紧急</span>
            </div>
            <div className="legend-item">
              <div className="legend-bar normal"></div>
              <span>普通</span>
            </div>
          </div>

          {loading && queue.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">⏳</div>
              <div>加载中...</div>
            </div>
          ) : queue.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">✅</div>
              <div>暂无病人排队</div>
            </div>
          ) : (
            <div className="queue-list">
              {queue.map((patient, index) => (
                <div key={patient.id} className={`queue-item ${getPriorityClass(patient)}`}>
                  <div className="queue-item-info">
                    <div className="queue-item-name">
                      {patient.name}
                      {patient.is_elderly && <span className="elderly-tag">老人</span>}
                      {index === 0 && (
                        <span style={{
                          fontSize: '11px',
                          padding: '2px 8px',
                          borderRadius: '10px',
                          background: '#f6ad55',
                          color: 'white'
                        }}>下一位</span>
                      )}
                    </div>
                    <div className="queue-item-meta">
                      {patient.age}岁 {patient.gender || ''}
                      {patient.phone && ` · ${patient.phone}`}
                      {' · 优先级分数: '}
                      <strong style={{ color: '#2d3748' }}>{patient.priority_score}</strong>
                    </div>
                    <div className="queue-item-symptoms">
                      {patient.symptom_ids.map((sid) => {
                        const info = getSymptomInfo(sid);
                        return (
                          <span
                            key={sid}
                            className={`symptom-tag ${info?.is_high_risk ? 'high-risk' : ''}`}
                          >
                            {getSymptomName(sid)}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div className="queue-number">{index + 1}</div>
                    <button
                      className="btn btn-danger"
                      style={{ padding: '4px 10px', fontSize: '12px' }}
                      onClick={() => handleCancel(patient.id)}
                    >
                      取消
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="panel">
        <div className="panel-header">
          <h2>📊 队列统计</h2>
        </div>
        <div className="panel-body">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div style={{
              padding: '16px',
              background: '#fff5f5',
              borderRadius: '8px',
              textAlign: 'center'
            }}>
              <div style={{ fontSize: '32px', fontWeight: '700', color: '#e53e3e' }}>
                {queue.filter((p) => getPriorityClass(p) === 'priority-high').length}
              </div>
              <div style={{ fontSize: '13px', color: '#718096', marginTop: '4px' }}>
                优先病人
              </div>
            </div>
            <div style={{
              padding: '16px',
              background: '#fffff0',
              borderRadius: '8px',
              textAlign: 'center'
            }}>
              <div style={{ fontSize: '32px', fontWeight: '700', color: '#d69e2e' }}>
                {queue.filter((p) => getPriorityClass(p) === 'priority-mid').length}
              </div>
              <div style={{ fontSize: '13px', color: '#718096', marginTop: '4px' }}>
                较紧急
              </div>
            </div>
            <div style={{
              padding: '16px',
              background: '#f7fafc',
              borderRadius: '8px',
              textAlign: 'center',
              gridColumn: '1 / -1'
            }}>
              <div style={{ fontSize: '40px', fontWeight: '700', color: '#2d3748' }}>
                {queue.length}
              </div>
              <div style={{ fontSize: '13px', color: '#718096', marginTop: '4px' }}>
                等待总人数
              </div>
            </div>
          </div>

          <div style={{
            marginTop: '24px',
            padding: '16px',
            background: '#ebf8ff',
            borderRadius: '8px',
            fontSize: '13px',
            color: '#2c5282'
          }}>
            <strong>排队优先级计算规则：</strong>
            <ul style={{ paddingLeft: '20px', marginTop: '8px', lineHeight: '1.8' }}>
              <li>基础分 = 症状严重度 × 10（每个症状）</li>
              <li>老人加分 = +30（65岁及以上）</li>
              <li>高危加分 = +50（每个高危症状）</li>
              <li>同分时按登记时间先后排序</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
