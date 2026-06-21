import { useState, useEffect } from 'react';
import { api } from '../api.js';

export default function PatientRegistration({ onSuccess, refreshStats }) {
  const [symptoms, setSymptoms] = useState([]);
  const [form, setForm] = useState({
    name: '',
    age: '',
    gender: '',
    phone: '',
    id_card: '',
    address: '',
    symptom_ids: [],
    description: ''
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadSymptoms();
  }, []);

  const loadSymptoms = async () => {
    try {
      const data = await api.getSymptoms();
      setSymptoms(data);
    } catch (err) {
      onSuccess('加载症状列表失败: ' + err.message, 'error');
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const toggleSymptom = (id) => {
    setForm((prev) => ({
      ...prev,
      symptom_ids: prev.symptom_ids.includes(id)
        ? prev.symptom_ids.filter((s) => s !== id)
        : [...prev.symptom_ids, id]
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) {
      onSuccess('请填写病人姓名', 'error');
      return;
    }
    if (!form.age || form.age < 0 || form.age > 150) {
      onSuccess('请填写有效年龄', 'error');
      return;
    }
    if (form.symptom_ids.length === 0) {
      onSuccess('请至少选择一个症状', 'error');
      return;
    }

    setSubmitting(true);
    try {
      await api.createPatient({
        ...form,
        age: parseInt(form.age)
      });
      onSuccess('病人登记成功！', 'success');
      setForm({
        name: '',
        age: '',
        gender: '',
        phone: '',
        id_card: '',
        address: '',
        symptom_ids: [],
        description: ''
      });
      refreshStats();
    } catch (err) {
      onSuccess('登记失败: ' + err.message, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const selectedSymptoms = symptoms.filter((s) => form.symptom_ids.includes(s.id));
  const hasHighRisk = selectedSymptoms.some((s) => s.is_high_risk === 1);
  const isElderly = parseInt(form.age) >= 65;

  return (
    <div className="content-grid">
      <div className="panel">
        <div className="panel-header">
          <h2>📝 病人登记表</h2>
        </div>
        <div className="panel-body">
          <form onSubmit={handleSubmit}>
            <div className="form-grid">
              <div className="form-row">
                <label>姓名<span className="required">*</span></label>
                <input
                  type="text"
                  name="name"
                  value={form.name}
                  onChange={handleChange}
                  placeholder="请输入病人姓名"
                />
              </div>
              <div className="form-row">
                <label>年龄<span className="required">*</span></label>
                <input
                  type="number"
                  name="age"
                  value={form.age}
                  onChange={handleChange}
                  placeholder="请输入年龄"
                  min="0"
                  max="150"
                />
              </div>
            </div>
            <div className="form-grid">
              <div className="form-row">
                <label>性别</label>
                <select name="gender" value={form.gender} onChange={handleChange}>
                  <option value="">请选择</option>
                  <option value="男">男</option>
                  <option value="女">女</option>
                </select>
              </div>
              <div className="form-row">
                <label>联系电话</label>
                <input
                  type="tel"
                  name="phone"
                  value={form.phone}
                  onChange={handleChange}
                  placeholder="请输入电话号码"
                />
              </div>
            </div>
            <div className="form-grid">
              <div className="form-row">
                <label>身份证号</label>
                <input
                  type="text"
                  name="id_card"
                  value={form.id_card}
                  onChange={handleChange}
                  placeholder="请输入身份证号"
                />
              </div>
              <div className="form-row">
                <label>住址</label>
                <input
                  type="text"
                  name="address"
                  value={form.address}
                  onChange={handleChange}
                  placeholder="请输入住址"
                />
              </div>
            </div>
            <div className="form-row">
              <label>症状<span className="required">*</span></label>
              <div className="symptoms-grid">
                {symptoms.map((symptom) => (
                  <label
                    key={symptom.id}
                    className={`symptom-checkbox ${symptom.is_high_risk ? 'high-risk' : ''}`}
                  >
                    <input
                      type="checkbox"
                      checked={form.symptom_ids.includes(symptom.id)}
                      onChange={() => toggleSymptom(symptom.id)}
                    />
                    <span>{symptom.name}</span>
                    {symptom.is_high_risk ? (
                      <span className="risk-tag">高危</span>
                    ) : (
                      <span className="severity">{'★'.repeat(symptom.severity)}</span>
                    )}
                  </label>
                ))}
              </div>
            </div>
            <div className="form-row">
              <label>病情描述</label>
              <textarea
                name="description"
                value={form.description}
                onChange={handleChange}
                placeholder="请简要描述病人的病情..."
              />
            </div>

            {(hasHighRisk || isElderly) && (
              <div style={{
                padding: '10px 14px',
                background: hasHighRisk ? '#fff5f5' : '#faf5ff',
                border: `1px solid ${hasHighRisk ? '#fed7d7' : '#e9d8fd'}`,
                borderRadius: '6px',
                marginBottom: '16px',
                fontSize: '13px',
                color: hasHighRisk ? '#742a2a' : '#553c9a'
              }}>
                ⚠️ {hasHighRisk && '包含高危症状，'}
                {isElderly && '病人为65岁以上老人，'}
                将自动获得排队优先权！
              </div>
            )}

            <button type="submit" className="btn btn-primary btn-large" disabled={submitting}>
              {submitting ? '登记中...' : '✅ 提交登记'}
            </button>
          </form>
        </div>
      </div>

      <div className="panel">
        <div className="panel-header">
          <h2>📋 登记说明</h2>
        </div>
        <div className="panel-body" style={{ fontSize: '14px', lineHeight: '1.8', color: '#4a5568' }}>
          <p><strong>排队规则：</strong></p>
          <ul style={{ paddingLeft: '20px', marginTop: '8px', marginBottom: '16px' }}>
            <li>按症状严重度自动排序</li>
            <li><span style={{ color: '#b794f4', fontWeight: '600' }}>65岁以上老人</span> 加权插队（+30分）</li>
            <li><span style={{ color: '#fc8181', fontWeight: '600' }}>高危症状</span> 加权插队（+50分/项）</li>
            <li>同一位医生不能同时接诊两位病人</li>
          </ul>

          <p><strong>症状严重度等级：</strong></p>
          <ul style={{ paddingLeft: '20px', marginTop: '8px' }}>
            <li>★☆☆☆☆ - 轻微</li>
            <li>★★☆☆☆ - 较轻</li>
            <li>★★★☆☆ - 一般</li>
            <li>★★★★☆ - 较重</li>
            <li>★★★★★ - 严重</li>
            <li style={{ color: '#e53e3e' }}>高危 - 需紧急处理</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
