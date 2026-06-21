const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'clinic.db');
const db = new Database(dbPath);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

function initDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS symptoms (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      severity INTEGER NOT NULL DEFAULT 1 CHECK (severity BETWEEN 1 AND 5),
      is_high_risk INTEGER NOT NULL DEFAULT 0 CHECK (is_high_risk IN (0, 1)),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS patients (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      age INTEGER NOT NULL,
      gender TEXT,
      phone TEXT,
      id_card TEXT,
      address TEXT,
      symptom_ids TEXT NOT NULL,
      description TEXT,
      status TEXT NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting', 'consulting', 'done', 'cancelled')),
      priority_score INTEGER NOT NULL DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS doctors (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      department TEXT,
      title TEXT,
      is_available INTEGER NOT NULL DEFAULT 1 CHECK (is_available IN (0, 1)),
      current_patient_id INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (current_patient_id) REFERENCES patients(id)
    );

    CREATE TABLE IF NOT EXISTS consultations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      patient_id INTEGER NOT NULL,
      doctor_id INTEGER NOT NULL,
      start_time DATETIME DEFAULT CURRENT_TIMESTAMP,
      end_time DATETIME,
      diagnosis TEXT,
      prescription TEXT,
      advice TEXT,
      status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled')),
      FOREIGN KEY (patient_id) REFERENCES patients(id),
      FOREIGN KEY (doctor_id) REFERENCES doctors(id)
    );
  `);

  const symptomCount = db.prepare('SELECT COUNT(*) as count FROM symptoms').get().count;
  if (symptomCount === 0) {
    const insertSymptom = db.prepare(`
      INSERT INTO symptoms (name, severity, is_high_risk) VALUES (?, ?, ?)
    `);
    const defaultSymptoms = [
      ['发热', 3, 0],
      ['咳嗽', 2, 0],
      ['头痛', 2, 0],
      ['胸痛', 5, 1],
      ['呼吸困难', 5, 1],
      ['腹痛', 3, 0],
      ['头晕', 3, 0],
      ['外伤出血', 4, 1],
      ['意识模糊', 5, 1],
      ['高血压', 3, 0],
      ['糖尿病', 3, 0],
      ['感冒', 1, 0],
      ['腹泻', 2, 0],
      ['呕吐', 2, 0],
      ['皮疹', 1, 0],
      ['关节痛', 2, 0],
      ['胸闷', 4, 1],
      ['心悸', 4, 1],
      ['中风症状', 5, 1],
      ['严重过敏', 5, 1]
    ];
    const tx = db.transaction((symptoms) => {
      for (const [name, severity, isHighRisk] of symptoms) {
        insertSymptom.run(name, severity, isHighRisk);
      }
    });
    tx(defaultSymptoms);
  }

  const doctorCount = db.prepare('SELECT COUNT(*) as count FROM doctors').get().count;
  if (doctorCount === 0) {
    const insertDoctor = db.prepare(`
      INSERT INTO doctors (name, department, title, is_available) VALUES (?, ?, ?, ?)
    `);
    const defaultDoctors = [
      ['张医生', '全科', '主治医师', 1],
      ['李医生', '内科', '副主任医师', 1],
      ['王医生', '外科', '主治医师', 1],
      ['赵医生', '急诊科', '主任医师', 1]
    ];
    const tx = db.transaction((doctors) => {
      for (const [name, department, title, isAvailable] of doctors) {
        insertDoctor.run(name, department, title, isAvailable);
      }
    });
    tx(defaultDoctors);
  }
}

initDatabase();

module.exports = db;
