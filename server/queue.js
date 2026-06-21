const db = require('./db');

const ELDERLY_AGE_THRESHOLD = 65;
const ELDERLY_WEIGHT = 30;
const HIGH_RISK_WEIGHT = 50;
const BASE_PRIORITY_MULTIPLIER = 10;

function calculatePriorityScore(age, symptomIds) {
  let score = 0;

  if (age >= ELDERLY_AGE_THRESHOLD) {
    score += ELDERLY_WEIGHT;
  }

  if (symptomIds && symptomIds.length > 0) {
    const placeholders = symptomIds.map(() => '?').join(',');
    const symptoms = db.prepare(
      `SELECT severity, is_high_risk FROM symptoms WHERE id IN (${placeholders})`
    ).all(...symptomIds);

    for (const symptom of symptoms) {
      score += symptom.severity * BASE_PRIORITY_MULTIPLIER;
      if (symptom.is_high_risk === 1) {
        score += HIGH_RISK_WEIGHT;
      }
    }
  }

  return score;
}

function getSortedWaitingQueue() {
  const waitingPatients = db.prepare(`
    SELECT * FROM patients 
    WHERE status = 'waiting'
    ORDER BY priority_score DESC, created_at ASC
  `).all();

  return waitingPatients.map(p => ({
    ...p,
    symptom_ids: JSON.parse(p.symptom_ids),
    is_elderly: p.age >= ELDERLY_AGE_THRESHOLD
  }));
}

function getNextPatientForDoctor(doctorId) {
  const doctor = db.prepare('SELECT * FROM doctors WHERE id = ?').get(doctorId);
  if (!doctor) return null;
  if (doctor.current_patient_id) return null;

  const queue = getSortedWaitingQueue();
  return queue.length > 0 ? queue[0] : null;
}

function canAssignPatientToDoctor(doctorId) {
  const doctor = db.prepare('SELECT * FROM doctors WHERE id = ?').get(doctorId);
  if (!doctor) return false;
  return doctor.is_available === 1 && doctor.current_patient_id === null;
}

module.exports = {
  calculatePriorityScore,
  getSortedWaitingQueue,
  getNextPatientForDoctor,
  canAssignPatientToDoctor,
  ELDERLY_AGE_THRESHOLD
};
