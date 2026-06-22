import { useState, useEffect } from 'react';
import { api } from '../api.js';

export default function DoctorWorkspace({ onSuccess, refreshStats }) {
  const [doctors, setDoctors] = useState([]);
  const [selectedDoctor, setSelectedDoctor] = useState(null);
  const [activeConsultation, setActiveConsultation] = useState(null);
  const [form, setForm] = useState({ diagnosis: '', prescription: '', advice: '' });
  const [loading, setLoading] = useState(false);

  const loadDoctors = async () => {
    try {
      const data = await api.getDoctors();
      setDoctors(data);
      if (!selectedDoctor && data.length > 0) {
        setSelectedDoctor(data[0].id);
      }
    } catch (err) {
      console.error('加载医生列表失败:', err);
    }
  };

  const loadActiveConsultation = async (doctorId) => {
    if (!doctorId) return;
    try {
      const data = await api.getActiveConsultation(doctorId);
      setActiveConsultation(data);
      if (data) {
        setForm({
          diagnosis: data.diagnosis || '',
          prescription: data.prescription || '',
          advice: data.advice || ''
        });
      } else {
        setForm({ diagnosis: '', prescription: '', advice: '' });
      }
    } catch (err) {
      console.error('加载接诊信息失败:', err);
    }
  };

  useEffect(() => {
    loadDoctors();
  }, []);

  useEffect(() => {
    if (selectedDoctor) {
      loadActiveConsultation(selectedDoctor);
      const interval = setInterval(() => loadActiveConsultation(selectedDoctor), 3000);
      return () => clearInterval(interval);
    }
  }, [selectedDoctor]);

  const handleCallNext = async (doctorId) => {
    if (!doctorId) return;
    setLoading(true);
    try {
      const result = await api.callNextPatient(doctorId);
      onSuccess(`${doctors.find((d) => d.id === doctorId)?.name || '医生'}已叫号：${result.patient.name}`, 'success');
      setSelectedDoctor(doctorId);
      loadActiveConsultation(doctorId);
      loadDoctors();
      refreshStats();
    } catch (err) {
      onSuccess(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleComplete = async () => {
    if (!activeConsultation) return;
    if (!form.diagnosis.trim()) {
      onSuccess('请填写诊断结果', 'error');
      return;
    }
    setLoading(true);
    try {
      await api.completeConsultation(activeConsultation.id, form);
      onSuccess('接诊完成！', 'success');
      setActiveConsultation(null);
      loadActiveConsultation(selectedDoctor);
      loadDoctors();
      refreshStats();
    } catch (err) {
      onSuccess('完成接诊失败: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleAvailability = async (doctorId, currentAvailability) => {
    try {
      await api.setDoctorAvailability(doctorId, !currentAvailability);
      onSuccess('医生状态已更新', 'success');
      loadDoctors();
    } catch (err) {
      onSuccess(err.message, 'error');
    }
  };

  return (
    <div>
      <div className="panel" style={{ marginBottom: '24px' }}>
        <div className="panel-header">
          <h2>👨‍⚕️ 医生列表</h2>
          <button className="refresh-btn" onClick={loadDoctors}>🔄 刷新</button>
        </div>
        <div className="panel-body">
          <div className="doctor-list">
            {doctors.map((doctor) => {
              const isSelected = selectedDoctor === doctor.id;
              const isBusy = doctor.current_patient_id !== null;
              const statusClass = !doctor.is_available
                ? 'status-unavailable'
                : isBusy
                ? 'status-busy'
                : 'status-available';
              const statusText = !doctor.is_available
                ? '不可用'
                : isBusy
                ? '接诊中'
                : '空闲';

              return (
                <div
                  key={doctor.id}
                  className={`doctor-card ${isBusy ? 'busy' : ''} ${!doctor.is_available ? 'unavailable' : ''}`}
                  style={{
                    border: isSelected ? '2px solid #3182ce' : undefined,
                    cursor: 'pointer'
                  }}
                  onClick={() => setSelectedDoctor(doctor.id)}
                >
                  <div className="doctor-header">
                    <div>
                      <div className="doctor-name">{doctor.name}</div>
                      <div className="doctor-title">
                        {doctor.department} {doctor.title ? `· ${doctor.title}` : ''}
                      </div>
                    </div>
                    <span className={`doctor-status ${statusClass}`}>{statusText}</span>
                  </div>
                  {isBusy && (
                    <div className="doctor-current-patient">
                      📋 当前正在接诊病人 ID: {doctor.current_patient_id}
                    </div>
                  )}
                  <div className="doctor-actions" onClick={(e) => e.stopPropagation()}>
                    <button
                      className="btn btn-primary"
                      onClick={() => handleCallNext(doctor.id)}
                      disabled={!doctor.is_available || isBusy || loading}
                    >
                      {loading ? '叫号中...' : '📢 叫下一位'}
                    </button>
                    <button
                      className={`btn ${doctor.is_available ? 'btn-secondary' : 'btn-success'}`}
                      onClick={() => handleToggleAvailability(doctor.id, doctor.is_available)}
                      disabled={isBusy}
                    >
                      {doctor.is_available ? '设为不可用' : '设为可用'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="panel consultation-panel">
        <div className="panel-header">
          <h2>💊 接诊工作台</h2>
          {selectedDoctor && doctors.find((d) => d.id === selectedDoctor) && (
            <span style={{ fontSize: '14px', color: '#718096' }}>
              当前医生: {doctors.find((d) => d.id === selectedDoctor).name}
            </span>
          )}
        </div>

        {activeConsultation ? (
          <div>
            <div className="consultation-patient-info">
              <h3>
                {activeConsultation.patient_name}
                {activeConsultation.patient_is_elderly && (
                  <span className="elderly-tag" style={{ marginLeft: '8px' }}>老人</span>
                )}
              </h3>
              <div className="consultation-patient-details">
                <div>
                  <span className="label">年龄：</span>
                  {activeConsultation.patient_age}岁
                </div>
                <div>
                  <span className="label">性别：</span>
                  {activeConsultation.patient_gender || '未填'}
                </div>
                <div>
                  <span className="label">电话：</span>
                  {activeConsultation.patient_phone || '未填'}
                </div>
                <div>
                  <span className="label">身份证：</span>
                  {activeConsultation.patient_id_card || '未填'}
                </div>
                <div style={{ gridColumn: '1 / -1' }}>
                  <span className="label">住址：</span>
                  {activeConsultation.patient_address || '未填'}
                </div>
              </div>
            </div>
            <div className="consultation-body">
              <div style={{ marginBottom: '16px' }}>
                <div style={{ fontSize: '13px', color: '#718096', marginBottom: '6px' }}>病人症状：</div>
                <div className="consultation-symptoms">
                  {activeConsultation.patient_symptoms?.map((sym) => (
                    <span
                      key={sym.id}
                      className={`symptom-tag ${sym.is_high_risk ? 'high-risk' : ''}`}
                      style={{ fontSize: '13px', padding: '4px 12px' }}
                    >
                      {sym.name} ({'★'.repeat(sym.severity)})
                    </span>
                  ))}
                </div>
              </div>
              {activeConsultation.patient_description && (
                <div style={{ marginBottom: '20px', padding: '12px', background: '#f7fafc', borderRadius: '6px' }}>
                  <div style={{ fontSize: '13px', color: '#718096', marginBottom: '4px' }}>病情描述：</div>
                  <div style={{ fontSize: '14px' }}>{activeConsultation.patient_description}</div>
                </div>
              )}

              <div className="form-row">
                <label>诊断结果<span className="required">*</span></label>
                <textarea
                  name="diagnosis"
                  value={form.diagnosis}
                  onChange={handleFormChange}
                  placeholder="请填写诊断结果..."
                  style={{ minHeight: '80px' }}
                />
              </div>
              <div className="form-row">
                <label>处方用药</label>
                <textarea
                  name="prescription"
                  value={form.prescription}
                  onChange={handleFormChange}
                  placeholder="请填写处方用药..."
                />
              </div>
              <div className="form-row">
                <label>医嘱建议</label>
                <textarea
                  name="advice"
                  value={form.advice}
                  onChange={handleFormChange}
                  placeholder="请填写医嘱建议..."
                />
              </div>

              <button
                className="btn btn-success btn-large"
                onClick={handleComplete}
                disabled={loading}
              >
                {loading ? '提交中...' : '✅ 完成接诊'}
              </button>
            </div>
          </div>
        ) : (
          <div className="empty-state">
            <div className="empty-icon">⏸️</div>
            <div>当前没有进行中的接诊</div>
            <div style={{ fontSize: '13px', marginTop: '8px' }}>
              点击上方医生卡片的"📢 叫下一位"按钮开始接诊
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
