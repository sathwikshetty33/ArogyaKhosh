export type Role = 'patient' | 'doctor' | 'admin'

export interface User {
  id: number
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
  hospital_id: number
  qualification: string
  position?: string
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

async function post<T>(path: string, body: unknown): Promise<T> {
  let response: Response

  try {
    response = await fetch(`${BASE}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
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

export const api = {
  login: (input: LoginInput) => post<AuthResult>('/auth/login', input),
  registerPatient: (input: PatientInput) => post<AuthResult>('/auth/register/patient', input),
  registerDoctor: (input: DoctorInput) => post<AuthResult>('/auth/register/doctor', input),
}
