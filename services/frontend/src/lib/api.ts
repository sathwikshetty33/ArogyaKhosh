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

  const payload = await response.json().catch(() => null)

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
}
