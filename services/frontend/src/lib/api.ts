export type Role = 'patient' | 'doctor' | 'admin'

export interface User {
  id: string
  username: string
  full_name: string
  email: string
  role: Role
  created_at: string
}

export interface AuthResult {
  token: string
  expires_in: number
  user: User
  role?: Role
  profile?: unknown
}

export interface LoginInput {
  identifier: string
  password: string
}

export interface PatientInput {
  username: string
  full_name: string
  email: string
  password: string
  blood_group?: string
  height_cm?: number
  weight_kg?: number
  emergency_contact_email?: string
}

export interface DoctorInput {
  username: string
  full_name: string
  email: string
  password: string
  hospital_id: string
  qualification: string
  position?: string
}

export interface Hospital {
  id: string
  name: string
  city: string | null
}

export interface PatientProfile {
  id: string
  user_id: string
  blood_group: string | null
  height_cm: number | null
  weight_kg: number | null
  emergency_contact_email: string | null
}

export interface DoctorProfile {
  id: string
  user_id: string
  hospital_id: string
  qualification: string
  position: string | null
  hospital?: Hospital | null
}

export interface Me {
  current_user_id: string
  role: Role
  user: User
  patient?: PatientProfile
  doctor?: DoctorProfile
}

export type AccessLevel = 'owner' | 'granted' | 'public'

export interface PatientDocument {
  id: string
  name: string
  visibility: 'public' | 'private'
  content_type: string | null
  size_bytes: number | null
  created_at: string
}

export interface AccessGrant {
  id: string
  doctor_name: string
  hospital: string
  qualification: string
  granted_by_email: string | null
  granted_at: string | null
  expires_at: string | null
}

export interface PatientRecord {
  current_user_id: string
  access: AccessLevel
  patient: {
    id: string
    user_id: string
    username: string
    full_name: string
    email?: string
    blood_group?: string
    height_cm?: number
    weight_kg?: number
    emergency_contact_email?: string
    created_at: string
  }
  documents: PatientDocument[]
  grants?: AccessGrant[]
}

export type RequestStatus = 'pending' | 'granted' | 'declined' | 'revoked'

export interface AccessRequest {
  id: string
  status: RequestStatus
  active: boolean
  patient_id: string
  patient_name: string
  doctor_id: string
  doctor_name: string
  hospital: string
  qualification: string
  position: string | null
  granted_by_email: string | null
  granted_at: string | null
  expires_at: string | null
  created_at: string
  updated_at: string
}

export interface PatientSearchResult {
  id: string
  full_name: string
  username: string
  request_status: RequestStatus | null
  active: boolean
}

export interface DoctorUpdate {
  qualification?: string
  position?: string
  hospital_id?: string
}

export interface PatientUpdate {
  blood_group?: string
  height_cm?: number
  weight_kg?: number
  emergency_contact_email?: string
}

export interface DocumentUpdate {
  name?: string
  visibility?: 'public' | 'private'
}

export interface SignedDownload {
  url: string
  expires_in: number
  expires_at: string
  document: PatientDocument
}

export type AccidentStatus = 'reported' | 'notified' | 'confirmed' | 'dismissed' | 'resolved'

export interface AccidentGrant {
  request_id: string
  doctor_name: string
  hospital: string
  status: RequestStatus
  granted_at: string | null
}

export interface PatientAccident {
  id: string
  status: AccidentStatus
  open: boolean
  reported_at: string
  notified_email: string | null
  notified_at: string | null
  decided_at: string | null
  window_expires_at: string | null
  model_verdict: boolean | null
  confidence: number | null
  latitude: number | null
  longitude: number | null
  photo_url?: string
  grants: AccidentGrant[]
}

export interface AccidentReport {
  id: string
  status: AccidentStatus
  patient_first_name: string
  photo_scored: boolean
  contact_notified: boolean
}

export interface ApprovalView {
  id: string
  status: AccidentStatus
  patient_first_name: string
  reported_at: string
  photo_url?: string
  model_verdict?: boolean
  latitude?: number
  longitude?: number
  decided_at?: string
  link_expires_at?: string
  window_expires_at?: string
}

export interface GrantLinkView {
  request_id: string
  status: RequestStatus
  patient_first_name: string
  doctor_name: string
  hospital: string
  qualification: string
  position: string | null
  requested_at: string
  access_until?: string
  accident_confirmed: boolean
}

export class ApiError extends Error {
  status: number

  constructor(status: number, message: string) {
    super(message)
    this.status = status
    this.name = 'ApiError'
  }
}

const BASE = '/api/v1'

async function request<T>(path: string, init: RequestInit): Promise<T> {
  let response: Response

  try {
    response = await fetch(`${BASE}${path}`, init)
  } catch {
    throw new ApiError(0, 'Cannot reach the server. Check your connection and try again.')
  }

  const payload =
    response.status === 204 ? null : await response.json().catch(() => null)

  if (!response.ok) {
    const message =
      payload && typeof payload === 'object' && 'error' in payload
        ? String((payload as { error: unknown }).error)
        : 'Something went wrong. Try again.'

    throw new ApiError(response.status, message)
  }

  return payload as T
}

function get<T>(token: string, path: string): Promise<T> {
  return request<T>(path, { headers: { Authorization: `Bearer ${token}` } })
}

function send<T>(method: string, token: string, path: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = { Authorization: `Bearer ${token}` }
  if (body !== undefined) headers['Content-Type'] = 'application/json'

  return request<T>(path, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  })
}

function post<T>(path: string, body: unknown): Promise<T> {
  return request<T>(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

export const api = {
  login: (input: LoginInput) => post<AuthResult>('/auth/login', input),
  registerPatient: (input: PatientInput) => post<AuthResult>('/auth/register/patient', input),
  registerDoctor: (input: DoctorInput) => post<AuthResult>('/auth/register/doctor', input),

  me: (token: string) => get<Me>(token, '/me'),
  patient: (token: string, id: string) => get<PatientRecord>(token, `/patients/${id}`),

  updatePatient: (token: string, id: string, input: PatientUpdate) =>
    send<PatientRecord['patient']>('PATCH', token, `/patients/${id}`, input),

  uploadDocument: async (
    token: string,
    patientId: string,
    file: File,
    name: string,
    visibility: 'public' | 'private',
  ) => {
    const form = new FormData()
    form.append('file', file)
    form.append('name', name)
    form.append('visibility', visibility)

    return request<PatientDocument>(`/patients/${patientId}/documents`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    })
  },

  updateDocument: (token: string, id: string, input: DocumentUpdate) =>
    send<PatientDocument>('PATCH', token, `/documents/${id}`, input),

  deleteDocument: (token: string, id: string) =>
    send<void>('DELETE', token, `/documents/${id}`),

  documentURL: (token: string, id: string) => get<SignedDownload>(token, `/documents/${id}/url`),

  hospitals: (token: string) =>
    get<{ hospitals: Hospital[] }>(token, '/hospitals'),

  searchPatients: (token: string, query: string) =>
    get<{ results: PatientSearchResult[] }>(
      token,
      `/patients/search?q=${encodeURIComponent(query)}`,
    ),

  doctorRequests: (token: string, doctorId: string) =>
    get<{ doctor_id: string; requests: AccessRequest[] }>(
      token,
      `/doctors/${doctorId}/requests`,
    ),

  updateDoctor: (token: string, id: string, input: DoctorUpdate) =>
    send<DoctorProfile>('PATCH', token, `/doctors/${id}`, input),

  listRequests: (token: string, patientId: string) =>
    get<{ patient_id: string; requests: AccessRequest[] }>(token, `/patients/${patientId}/requests`),

  requestAccess: (token: string, patientId: string) =>
    send<AccessRequest>('POST', token, `/patients/${patientId}/requests`),

  approveRequest: (token: string, id: string, expiresInHours?: number) =>
    send<AccessRequest>(
      'POST',
      token,
      `/requests/${id}/approve`,
      expiresInHours ? { expires_in_hours: expiresInHours } : {},
    ),

  declineRequest: (token: string, id: string) =>
    send<AccessRequest>('POST', token, `/requests/${id}/decline`),

  revokeRequest: (token: string, id: string) =>
    send<AccessRequest>('POST', token, `/requests/${id}/revoke`),

  accidents: (token: string, patientId: string) =>
    get<{ patient_id: string; accidents: PatientAccident[] }>(
      token,
      `/patients/${patientId}/accidents`,
    ),

  closeAccident: (token: string, id: string) =>
    send<PatientAccident>('POST', token, `/accidents/${id}/close`),

  reportAccident: (patientId: string, photo: File | null, position: GeolocationCoordinates | null) => {
    const form = new FormData()
    if (photo) form.append('photo', photo)
    if (position) {
      form.append('latitude', String(position.latitude))
      form.append('longitude', String(position.longitude))
    }

    return request<AccidentReport>(`/accidents/${patientId}`, { method: 'POST', body: form })
  },

  approval: (accidentId: string, key: string) =>
    request<ApprovalView>(`/accidents/${accidentId}/approval/${key}`, {}),

  decideApproval: (accidentId: string, key: string, decision: 'confirm' | 'dismiss' | 'resolve') =>
    post<ApprovalView>(`/accidents/${accidentId}/approval/${key}`, { decision }),

  grantLink: (token: string) => request<GrantLinkView>(`/grants/${token}`, {}),

  decideGrant: (token: string, decision: 'grant' | 'deny') =>
    post<GrantLinkView>(`/grants/${token}`, { decision }),
}
