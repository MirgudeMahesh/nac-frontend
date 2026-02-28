const API_BASE_URL = 'https://vitamin-d3-clone.onrender.com/api';

export const api = {
    // Users BE
    getUserByImacxId: async (imacxId: string) => {
        const res = await fetch(`${API_BASE_URL}/users?imacx_id=${imacxId}&single=true`);
        if (!res.ok) throw new Error('API Error fetching user');
        return res.json();
    },

    // Users BM
    getBmUsersByImacxId: async (imacxId: string) => {
        const res = await fetch(`${API_BASE_URL}/usersbm?imacx_id=${imacxId}`);
        if (!res.ok) throw new Error('API Error fetching BM users');
        return res.json();
    },

    getBmUsersByTerritory: async (territory: string) => {
        const res = await fetch(`${API_BASE_URL}/usersbm?territory=${territory}`);
        if (!res.ok) throw new Error('API Error fetching BM users');
        return res.json();
    },

    // Camps
    getCampsByUser: async (userId: string) => {
        const res = await fetch(`${API_BASE_URL}/camps?user_id=${userId}`);
        if (!res.ok) throw new Error('API Error fetching camps');
        return res.json();
    },

    getCampById: async (campId: string) => {
        const res = await fetch(`${API_BASE_URL}/camps/${campId}`);
        if (!res.ok) throw new Error('API Error fetching camp');
        return res.json();
    },

    createCamp: async (data: any) => {
        const res = await fetch(`${API_BASE_URL}/camps`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
        });
        if (!res.ok) throw new Error('API Error creating camp');
        return res.json();
    },

    updateCamp: async (campId: string, data: any) => {
        const res = await fetch(`${API_BASE_URL}/camps/${campId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
        });
        if (!res.ok) throw new Error('API Error updating camp');
        return res.json();
    },

    // Doctors
    getDoctorsByTerritory: async (territory: string, maxSelection: boolean = true) => {
        const res = await fetch(`${API_BASE_URL}/doctors?territory=${territory}&is_selected_by_marketing=${maxSelection}`);
        if (!res.ok) throw new Error('API Error fetching doctors');
        return res.json();
    },

    getDoctorsByTerritories: async (territories: string[], maxSelection: boolean = true) => {
        const res = await fetch(`${API_BASE_URL}/doctors?territories=${territories.join(',')}&is_selected_by_marketing=${maxSelection}`);
        if (!res.ok) throw new Error('API Error fetching doctors');
        return res.json();
    },

    createDoctor: async (data: any) => {
        const res = await fetch(`${API_BASE_URL}/doctors`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
        });
        if (!res.ok) throw new Error('API Error creating doctor');
        return res.json();
    },

    updateDoctor: async (doctorId: string, data: any) => {
        const res = await fetch(`${API_BASE_URL}/doctors/${doctorId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
        });
        if (!res.ok) throw new Error('API Error updating doctor');
        return res.json();
    },

    // Patients
    getPatientsByCamp: async (campId: string) => {
        const res = await fetch(`${API_BASE_URL}/patients?camp_id=${campId}`);
        if (!res.ok) throw new Error('API Error fetching patients');
        return res.json();
    },

    createPatient: async (data: any) => {
        const res = await fetch(`${API_BASE_URL}/patients`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
        });
        if (!res.ok) throw new Error('API Error creating patient');
        return res.json();
    },

    updatePatient: async (patientId: string, data: any) => {
        const res = await fetch(`${API_BASE_URL}/patients/${patientId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
        });
        if (!res.ok) throw new Error('API Error updating patient');
        return res.json();
    },

    // Storage Upload to internal handler
    uploadFile: async (file: File) => {
        const formData = new FormData();
        formData.append('file', file);
        const res = await fetch(`${API_BASE_URL}/upload`, {
            method: 'POST',
            body: formData,
        });
        if (!res.ok) throw new Error('API Error uploading file');
        const data = await res.json();
        return data.fileUrl;
    }
};
