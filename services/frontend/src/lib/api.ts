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
}
