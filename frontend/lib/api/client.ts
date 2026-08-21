import {
  ApiResponse,
  Role,
  ApplicationStatus,
  Internship,
  Application,
  StudentProfile,
  CompanyProfile,
  MentorAssignment,
  ProgressLog,
  InternshipCriteria,
} from '../types';

// Central API Base URL Configuration
// Default to canonical Render backend or environment variable
const API_BASE = (process.env.NEXT_PUBLIC_API_BASE_URL || 'https://kaushal-750e.onrender.com/api/v1').replace(/\/$/, '');

// Helper to retrieve auth token from browser storage or cookie
export function getToken(): string | null {
  if (typeof window !== 'undefined') {
    const fromStorage = localStorage.getItem('kaushal_token') || localStorage.getItem('token');
    if (fromStorage) return fromStorage;

    const cookieMatch = document.cookie
      .split(';')
      .map(c => c.trim())
      .find(c => c.startsWith('kaushal_token=') || c.startsWith('token='));
    if (cookieMatch) {
      return cookieMatch.split('=')[1];
    }
  }
  return null;
}

// Normalize MongoDB document (_id -> id, nested object normalization)
function normalizeDoc<T>(doc: any): T {
  if (!doc || typeof doc !== 'object') return doc;
  if (Array.isArray(doc)) return doc.map(normalizeDoc) as unknown as T;

  const normalized: any = { ...doc };
  if (doc._id && !doc.id) {
    normalized.id = doc._id.toString ? doc._id.toString() : String(doc._id);
  }

  // Student Profile normalization
  if (normalized.activeBacklogs !== undefined && normalized.backlogs === undefined) {
    normalized.backlogs = normalized.activeBacklogs;
  }

  // Application normalization
  if (normalized.studentId && typeof normalized.studentId === 'object') {
    normalized.studentName = normalized.studentId.userId?.name || normalized.studentId.name || normalized.studentName;
    normalized.studentDept = normalized.studentId.department || normalized.studentDept;
  }
  if (normalized.internshipId && typeof normalized.internshipId === 'object') {
    normalized.internshipTitle = normalized.internshipId.title || normalized.internshipTitle;
    normalized.companyName = normalized.internshipId.companyId?.companyName || normalized.companyName;
  }

  // Normalize nested properties
  for (const key of Object.keys(normalized)) {
    if (normalized[key] && typeof normalized[key] === 'object' && !(normalized[key] instanceof Date)) {
      normalized[key] = normalizeDoc(normalized[key]);
    }
  }

  return normalized as T;
}

// Central Request Wrapper
export async function request<T>(
  endpoint: string,
  method: string = 'GET',
  body?: any,
  options?: RequestInit
): Promise<ApiResponse<T>> {
  const token = getToken();
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  const url = `${API_BASE}${cleanEndpoint}`;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  try {
    const response = await fetch(url, {
      method,
      headers: {
        ...headers,
        ...(options?.headers as Record<string, string>),
      },
      body: body ? JSON.stringify(body) : undefined,
      ...options,
    });

    const json = await response.json().catch(() => ({}));

    if (!response.ok) {
      return {
        success: false,
        error: {
          code: json.error?.code || `HTTP_${response.status}`,
          message: json.error?.message || json.message || `Request failed with status ${response.status}`,
          details: json.error?.details || json.details,
        },
      };
    }

    const data = json.data !== undefined ? json.data : json;
    return {
      success: true,
      data: normalizeDoc<T>(data),
    };
  } catch (err: any) {
    return {
      success: false,
      error: {
        code: 'NETWORK_ERROR',
        message: err.message || 'Network request failed. Is the server reachable?',
      },
    };
  }
}

// Central API Client Object
export const apiClient = {
  auth: {
    login: (body: { email: string; password: string }) =>
      request<{ token: string; user: { id: string; name: string; email: string; role: Role; status: string } }>('/auth/login', 'POST', body),

    registerStudent: (body: any) =>
      request<{ token: string; user: any; profile: any }>('/auth/register', 'POST', body),

    registerCompany: (body: any) =>
      request<{ user: any; profile: any; message: string }>('/auth/register/company', 'POST', body),

    getMe: () =>
      request<{ user: any; profile: any }>('/auth/me', 'GET'),
  },

  student: {
    getProfile: () =>
      request<StudentProfile>('/student/profile', 'GET'),

    updateProfile: (body: Partial<StudentProfile>) =>
      request<StudentProfile>('/student/profile', 'PATCH', body),

    getInternships: () =>
      request<Internship[]>('/student/internships', 'GET'),

    getInternshipById: (id: string) =>
      request<{ internship: Internship; eligibility: any }>(`/student/internships/${id}`, 'GET'),

    applyToInternship: (body: { internshipId: string }) =>
      request<Application>('/student/applications', 'POST', body),

    getApplications: (status?: ApplicationStatus) =>
      request<Application[]>(`/student/applications${status ? `?status=${status}` : ''}`, 'GET'),

    acceptOffer: (applicationId: string) =>
      request<Application>(`/student/applications/${applicationId}/accept`, 'PATCH'),

    declineOffer: (applicationId: string) =>
      request<Application>(`/student/applications/${applicationId}/decline`, 'PATCH'),

    submitProgressLog: (applicationId: string, body: { description: string; evidence: { type: string; value: string }; weekLabel?: string }) =>
      request<ProgressLog>(`/student/applications/${applicationId}/progress-logs`, 'POST', body),

    getRecommendations: () =>
      request<{ method: string; recommendations: any[] }>('/student/recommendations', 'GET'),

    getWhatsNext: () =>
      request<{ action: string; counts: { eligible: number; applied: number; offered: number } }>('/student/whats-next', 'GET'),

    submitOffCampusOpportunity: (body: {
      companyName: string;
      title: string;
      description: string;
      duration: string;
      mode: string;
      stipend?: number;
      evidenceUrl?: string;
    }) =>
      request<any>('/student/off-campus-opportunities', 'POST', body),

    getOffCampusOpportunities: () =>
      request<any[]>('/student/off-campus-opportunities', 'GET'),
  },

  company: {
    postInternship: (body: any) =>
      request<Internship>('/company/internships', 'POST', body),

    getInternships: () =>
      request<Internship[]>('/company/internships', 'GET'),

    getInternshipById: (id: string) =>
      request<Internship>(`/company/internships/${id}`, 'GET'),

    updateInternshipCriteria: (id: string, body: Partial<InternshipCriteria>) =>
      request<Internship>(`/company/internships/${id}`, 'PATCH', body),

    closeInternship: (id: string) =>
      request<Internship>(`/company/internships/${id}/close`, 'PATCH'),

    getApplicants: (internshipId: string) =>
      request<any[]>(`/company/internships/${internshipId}/applicants`, 'GET'),

    shortlistApplicant: (applicationId: string) =>
      request<Application>(`/company/applications/${applicationId}/shortlist`, 'PATCH'),

    rejectApplicant: (applicationId: string, reason?: string) =>
      request<Application>(`/company/applications/${applicationId}/reject`, 'PATCH', { reason }),

    offerInternship: (applicationId: string) =>
      request<Application>(`/company/applications/${applicationId}/offer`, 'PATCH'),

    evaluateApplication: (applicationId: string, body: { rating?: number; ppoRecommended: boolean }) =>
      request<any>(`/company/applications/${applicationId}/evaluate`, 'POST', body),

    getWhatsNext: () =>
      request<{ action: string; counts: any }>('/company/whats-next', 'GET'),

    getAnalytics: () =>
      request<any>('/company/analytics', 'GET'),
  },

  faculty: {
    getAssignments: () =>
      request<MentorAssignment[]>('/faculty/assignments', 'GET'),

    acceptAssignment: (assignmentId: string) =>
      request<any>(`/faculty/assignments/${assignmentId}/accept`, 'PATCH'),

    rejectAssignment: (assignmentId: string, body: { reason: string }) =>
      request<any>(`/faculty/assignments/${assignmentId}/reject`, 'PATCH', body),

    getStudents: () =>
      request<any[]>('/faculty/students', 'GET'),

    getStudentsNoSubmission: () =>
      request<any[]>('/faculty/students/no-submission', 'GET'),

    getStudentProgress: (applicationId: string) =>
      request<ProgressLog[]>(`/faculty/applications/${applicationId}/progress`, 'GET'),

    verifyProgressLog: (logId: string) =>
      request<ProgressLog>(`/faculty/progress-logs/${logId}/verify`, 'PATCH'),

    dismissRiskFlag: (applicationId: string, body?: { note?: string }) =>
      request<any>(`/risk/${applicationId}/dismiss`, 'PATCH', body),

    getWhatsNext: () =>
      request<{ action: string; counts: any }>('/faculty/whats-next', 'GET'),
  },

  tnp: {
    createInvite: (body: { companyName: string; contactEmail: string }) =>
      request<any>('/tnp/invites', 'POST', body),

    createUser: (body: { name: string; email: string; password?: string; role: 'faculty' | 'hod'; department: string }) =>
      request<any>('/tnp/users', 'POST', body),

    getUsers: () =>
      request<any[]>('/tnp/users', 'GET'),

    getCompanies: () =>
      request<CompanyProfile[]>('/tnp/companies', 'GET'),

    verifyCompany: (companyUserId: string) =>
      request<any>(`/tnp/companies/${companyUserId}/verify`, 'PATCH'),

    getPendingInternships: () =>
      request<Internship[]>('/tnp/internships/pending-approval', 'GET'),

    approveInternship: (id: string) =>
      request<Internship>(`/tnp/internships/${id}/approve`, 'PATCH'),

    getVerificationQueue: () =>
      request<any[]>('/tnp/verification-queue', 'GET'),

    verifyOffer: (applicationId: string) =>
      request<Application>(`/tnp/applications/${applicationId}/verify-offer`, 'PATCH'),

    rejectOffer: (applicationId: string, reason: string) =>
      request<Application>(`/tnp/applications/${applicationId}/reject-offer`, 'PATCH', { reason }),

    overrideEligibility: (applicationId: string, body: { eligible: boolean; reason: string }) =>
      request<Application>(`/tnp/applications/${applicationId}/override`, 'PATCH', body),

    assignMentor: (body: { applicationId: string; facultyId: string }) =>
      request<any>('/tnp/assignments', 'POST', body),

    getUnassignedApplications: () =>
      request<Application[]>('/tnp/unassigned-queue', 'GET'),

    cancelApplication: (applicationId: string, body?: { reason?: string }) =>
      request<Application>(`/tnp/applications/${applicationId}/cancel`, 'PATCH', body),

    getAlerts: () =>
      request<any>('/tnp/alerts', 'GET'),

    getAnalyticsDashboard: () =>
      request<any>('/tnp/analytics/dashboard', 'GET'),

    getStudents: () =>
      request<any[]>('/tnp/students', 'GET'),

    getInternships: () =>
      request<Internship[]>('/tnp/internships', 'GET'),

    getWhatsNext: () =>
      request<{ action: string; alerts: any }>('/tnp/whats-next', 'GET'),

    getOffCampusQueue: () =>
      request<any[]>('/tnp/off-campus/verification-queue', 'GET'),

    verifyOffCampusOpportunity: (id: string) =>
      request<any>(`/tnp/off-campus/${id}/verify`, 'PATCH'),

    rejectOffCampusOpportunity: (id: string, body: { reason: string }) =>
      request<any>(`/tnp/off-campus/${id}/reject`, 'PATCH', body),
  },

  hod: {
    getDashboard: () =>
      request<any>('/hod/dashboard', 'GET'),

    getStudents: () =>
      request<any[]>('/hod/students', 'GET'),

    getStudentById: (studentId: string) =>
      request<any>(`/hod/students/${studentId}`, 'GET'),
  },

  risk: {
    getRiskForApplication: (applicationId: string) =>
      request<any>(`/risk/${applicationId}`, 'GET'),

    dismissRiskFlag: (applicationId: string, body?: { note?: string }) =>
      request<any>(`/risk/${applicationId}/dismiss`, 'PATCH', body),
  },

  analytics: {
    getFunnel: () =>
      request<any>('/analytics/funnel', 'GET'),

    getSkillGap: () =>
      request<any>('/analytics/skills-gap', 'GET'),

    getDepartmentStats: () =>
      request<any>('/analytics/department', 'GET'),

    getPpoOutcomes: () =>
      request<any>('/analytics/ppo-outcomes', 'GET'),

    getTnpAlerts: () =>
      request<any>('/analytics/alerts', 'GET'),

    getTnpDashboard: () =>
      request<any>('/analytics/dashboard', 'GET'),
  },
};

// Backward-compatibility exports for components
export const mockTnpUsers: any[] = [];
export const mockProgressLogs: any[] = [];
export function resetMockState() {
  if (typeof window !== 'undefined') {
    // Clear browser query caches on demand
    window.dispatchEvent(new Event('reset-cache'));
  }
}
