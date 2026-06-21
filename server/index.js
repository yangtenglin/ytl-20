const express = require('express');
const cors = require('cors');
const db = require('./db');
const {
  calculatePriorityScore,
  getSortedWaitingQueue,
  getNextPatientForDoctor,
  canAssignPatientToDoctor,
  ELDERLY_AGE_THRESHOLD
} = require('./queue');

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

app.get('/api/symptoms', (req, res) => {
  const symptoms = db.prepare('SELECT * FROM symptoms ORDER BY severity DESC, name ASC').all();
  res.json(symptoms);
});

app.post('/api/symptoms', (req, res) => {
  const { name, severity, is_high_risk } = req.body;
  if (!name || !severity) {
    return res.status(400).json({ error: '症状名称和严重度必填' });
  }
  try {
    const result = db.prepare(
      'INSERT INTO symptoms (name, severity, is_high_risk) VALUES (?, ?, ?)'
    ).run(name, severity, is_high_risk ? 1 : 0);
    const symptom = db.prepare('SELECT * FROM symptoms WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(symptom);
  } catch (err) {
    if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      return res.status(400).json({ error: '该症状已存在' });
    }
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/patients', (req, res) => {
  const { status } = req.query;
  let query = 'SELECT * FROM patients';
  const params = [];
  if (status) {
    query += ' WHERE status = ?';
    params.push(status);
  }
  query += ' ORDER BY created_at DESC';
  const patients = db.prepare(query).all(...params).map(p => ({
    ...p,
    symptom_ids: JSON.parse(p.symptom_ids),
    is_elderly: p.age >= ELDERLY_AGE_THRESHOLD
  }));
  res.json(patients);
});

app.get('/api/patients/queue', (req, res) => {
  const queue = getSortedWaitingQueue();
  res.json(queue);
});

app.get('/api/patients/:id', (req, res) => {
  const patient = db.prepare('SELECT * FROM patients WHERE id = ?').get(req.params.id);
  if (!patient) {
    return res.status(404).json({ error: '病人不存在' });
  }
  patient.symptom_ids = JSON.parse(patient.symptom_ids);
  patient.is_elderly = patient.age >= ELDERLY_AGE_THRESHOLD;
  res.json(patient);
});

app.post('/api/patients', (req, res) => {
  const { name, age, gender, phone, id_card, address, symptom_ids, description } = req.body;
  if (!name || !age || !symptom_ids || symptom_ids.length === 0) {
    return res.status(400).json({ error: '姓名、年龄和至少一个症状必填' });
  }

  const priorityScore = calculatePriorityScore(age, symptom_ids);

  try {
    const result = db.prepare(`
      INSERT INTO patients (name, age, gender, phone, id_card, address, symptom_ids, description, priority_score)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      name, age, gender || null, phone || null, id_card || null,
      address || null, JSON.stringify(symptom_ids), description || null, priorityScore
    );

    const patient = db.prepare('SELECT * FROM patients WHERE id = ?').get(result.lastInsertRowid);
    patient.symptom_ids = JSON.parse(patient.symptom_ids);
    patient.is_elderly = patient.age >= ELDERLY_AGE_THRESHOLD;

    res.status(201).json(patient);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/patients/:id/cancel', (req, res) => {
  const patient = db.prepare('SELECT * FROM patients WHERE id = ?').get(req.params.id);
  if (!patient) {
    return res.status(404).json({ error: '病人不存在' });
  }
  if (patient.status === 'consulting') {
    return res.status(400).json({ error: '正在接诊中的病人无法取消' });
  }
  db.prepare("UPDATE patients SET status = 'cancelled' WHERE id = ?").run(req.params.id);
  const updated = db.prepare('SELECT * FROM patients WHERE id = ?').get(req.params.id);
  updated.symptom_ids = JSON.parse(updated.symptom_ids);
  res.json(updated);
});

app.get('/api/doctors', (req, res) => {
  const doctors = db.prepare('SELECT * FROM doctors ORDER BY id ASC').all();
  res.json(doctors);
});

app.get('/api/doctors/:id', (req, res) => {
  const doctor = db.prepare('SELECT * FROM doctors WHERE id = ?').get(req.params.id);
  if (!doctor) {
    return res.status(404).json({ error: '医生不存在' });
  }
  res.json(doctor);
});

app.post('/api/doctors', (req, res) => {
  const { name, department, title } = req.body;
  if (!name) {
    return res.status(400).json({ error: '医生姓名必填' });
  }
  const result = db.prepare(
    'INSERT INTO doctors (name, department, title) VALUES (?, ?, ?)'
  ).run(name, department || null, title || null);
  const doctor = db.prepare('SELECT * FROM doctors WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(doctor);
});

app.put('/api/doctors/:id/availability', (req, res) => {
  const { is_available } = req.body;
  const doctor = db.prepare('SELECT * FROM doctors WHERE id = ?').get(req.params.id);
  if (!doctor) {
    return res.status(404).json({ error: '医生不存在' });
  }
  if (!is_available && doctor.current_patient_id) {
    return res.status(400).json({ error: '医生正在接诊，无法设置为不可用' });
  }
  db.prepare('UPDATE doctors SET is_available = ? WHERE id = ?').run(
    is_available ? 1 : 0, req.params.id
  );
  const updated = db.prepare('SELECT * FROM doctors WHERE id = ?').get(req.params.id);
  res.json(updated);
});

app.post('/api/consultations/call-next/:doctorId', (req, res) => {
  const doctorId = parseInt(req.params.doctorId);

  if (!canAssignPatientToDoctor(doctorId)) {
    return res.status(400).json({ error: '医生当前不可用或正在接诊中' });
  }

  const nextPatient = getNextPatientForDoctor(doctorId);
  if (!nextPatient) {
    return res.status(404).json({ error: '暂无等待中的病人' });
  }

  const tx = db.transaction(() => {
    db.prepare("UPDATE patients SET status = 'consulting' WHERE id = ?").run(nextPatient.id);
    db.prepare('UPDATE doctors SET current_patient_id = ? WHERE id = ?').run(nextPatient.id, doctorId);

    const result = db.prepare(`
      INSERT INTO consultations (patient_id, doctor_id, status) VALUES (?, ?, 'active')
    `).run(nextPatient.id, doctorId);

    return db.prepare('SELECT * FROM consultations WHERE id = ?').get(result.lastInsertRowid);
  });

  try {
    const consultation = tx();
    const patient = db.prepare('SELECT * FROM patients WHERE id = ?').get(nextPatient.id);
    patient.symptom_ids = JSON.parse(patient.symptom_ids);
    patient.is_elderly = patient.age >= ELDERLY_AGE_THRESHOLD;

    res.status(201).json({ consultation, patient });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/consultations/:id/complete', (req, res) => {
  const { diagnosis, prescription, advice } = req.body;
  const consultation = db.prepare('SELECT * FROM consultations WHERE id = ?').get(req.params.id);

  if (!consultation) {
    return res.status(404).json({ error: '接诊记录不存在' });
  }
  if (consultation.status !== 'active') {
    return res.status(400).json({ error: '该接诊已处理完毕' });
  }
  if (!diagnosis) {
    return res.status(400).json({ error: '诊断结果必填' });
  }

  const tx = db.transaction(() => {
    db.prepare(`
      UPDATE consultations 
      SET status = 'completed', end_time = CURRENT_TIMESTAMP, diagnosis = ?, prescription = ?, advice = ?
      WHERE id = ?
    `).run(diagnosis, prescription || null, advice || null, req.params.id);

    db.prepare("UPDATE patients SET status = 'done' WHERE id = ?").run(consultation.patient_id);
    db.prepare('UPDATE doctors SET current_patient_id = NULL WHERE id = ?').run(consultation.doctor_id);
  });

  try {
    tx();
    const updated = db.prepare('SELECT * FROM consultations WHERE id = ?').get(req.params.id);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/consultations', (req, res) => {
  const { doctor_id, patient_id, status } = req.query;
  let query = `
    SELECT c.*, p.name as patient_name, p.age as patient_age,
           d.name as doctor_name, d.department as doctor_department
    FROM consultations c
    JOIN patients p ON c.patient_id = p.id
    JOIN doctors d ON c.doctor_id = d.id
    WHERE 1=1
  `;
  const params = [];
  if (doctor_id) {
    query += ' AND c.doctor_id = ?';
    params.push(doctor_id);
  }
  if (patient_id) {
    query += ' AND c.patient_id = ?';
    params.push(patient_id);
  }
  if (status) {
    query += ' AND c.status = ?';
    params.push(status);
  }
  query += ' ORDER BY c.start_time DESC';

  const consultations = db.prepare(query).all(...params);
  res.json(consultations);
});

app.get('/api/consultations/active/:doctorId', (req, res) => {
  const consultation = db.prepare(`
    SELECT c.*, p.name as patient_name, p.age as patient_age, p.gender as patient_gender,
           p.symptom_ids as patient_symptom_ids, p.description as patient_description,
           p.phone as patient_phone, p.id_card as patient_id_card, p.address as patient_address,
           d.name as doctor_name
    FROM consultations c
    JOIN patients p ON c.patient_id = p.id
    JOIN doctors d ON c.doctor_id = d.id
    WHERE c.doctor_id = ? AND c.status = 'active'
  `).get(req.params.doctorId);

  if (!consultation) {
    return res.json(null);
  }

  consultation.patient_symptom_ids = JSON.parse(consultation.patient_symptom_ids);
  const symptomDetails = db.prepare(
    `SELECT * FROM symptoms WHERE id IN (${consultation.patient_symptom_ids.map(() => '?').join(',')})`
  ).all(...consultation.patient_symptom_ids);
  consultation.patient_symptoms = symptomDetails;
  consultation.patient_is_elderly = consultation.patient_age >= ELDERLY_AGE_THRESHOLD;

  res.json(consultation);
});

app.get('/api/stats', (req, res) => {
  const waitingCount = db.prepare("SELECT COUNT(*) as count FROM patients WHERE status = 'waiting'").get().count;
  const consultingCount = db.prepare("SELECT COUNT(*) as count FROM patients WHERE status = 'consulting'").get().count;
  const doneCount = db.prepare("SELECT COUNT(*) as count FROM patients WHERE status = 'done'").get().count;
  const todayCount = db.prepare("SELECT COUNT(*) as count FROM patients WHERE DATE(created_at) = DATE('now')").get().count;

  const busyDoctors = db.prepare('SELECT COUNT(*) as count FROM doctors WHERE current_patient_id IS NOT NULL').get().count;
  const availableDoctors = db.prepare('SELECT COUNT(*) as count FROM doctors WHERE is_available = 1 AND current_patient_id IS NULL').get().count;

  res.json({
    waiting: waitingCount,
    consulting: consultingCount,
    done: doneCount,
    today: todayCount,
    busy_doctors: busyDoctors,
    available_doctors: availableDoctors
  });
});

app.listen(PORT, () => {
  console.log(`纸上诊所后端服务已启动: http://localhost:${PORT}`);
});
