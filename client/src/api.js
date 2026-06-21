const BASE_URL = '/api';

async function request(path, options = {}) {
  const response = await fetch(`${BASE_URL}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers
    },
    ...options
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || `请求失败 (${response.status})`);
  }
  return data;
}

export const api = {
  getSymptoms: () => request('/symptoms'),
  createSymptom: (data) => request('/symptoms', { method: 'POST', body: JSON.stringify(data) }),

  getPatients: (status) => request(`/patients${status ? `?status=${status}` : ''}`),
  getQueue: () => request('/patients/queue'),
  getPatient: (id) => request(`/patients/${id}`),
  createPatient: (data) => request('/patients', { method: 'POST', body: JSON.stringify(data) }),
  cancelPatient: (id) => request(`/patients/${id}/cancel`, { method: 'PUT' }),

  getDoctors: () => request('/doctors'),
  getDoctor: (id) => request(`/doctors/${id}`),
  createDoctor: (data) => request('/doctors', { method: 'POST', body: JSON.stringify(data) }),
  setDoctorAvailability: (id, isAvailable) =>
    request(`/doctors/${id}/availability`, { method: 'PUT', body: JSON.stringify({ is_available: isAvailable }) }),

  callNextPatient: (doctorId) => request(`/consultations/call-next/${doctorId}`, { method: 'POST' }),
  completeConsultation: (id, data) =>
    request(`/consultations/${id}/complete`, { method: 'PUT', body: JSON.stringify(data) }),
  getConsultations: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return request(`/consultations${query ? `?${query}` : ''}`);
  },
  getActiveConsultation: (doctorId) => request(`/consultations/active/${doctorId}`),

  getStats: () => request('/stats')
};
