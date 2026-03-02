export interface Tenant {
  id: string
  slug: string
  name: string
  display_name: string
  line_channel_access_token: string | null
  line_channel_secret: string | null
  line_bot_basic_id: string | null
  openai_api_key: string | null
  is_active: boolean
}

export interface OpenCampusDate {
  id: string
  tenant_id: string
  date: string
  capacity: number
  current_count: number
  is_active: boolean
}

export interface Course {
  id: string
  tenant_id: string
  name: string
  category: string | null
  description: string | null
  capacity_per_day: number | null
  is_active: boolean
  display_order: number | null
}

export interface ApplicantFormData {
  name: string
  kana_name?: string
  email: string
  phone: string
  school_name: string
  school_type?: string
  grade: string
  graduation_year?: number
  postal_code?: string
  prefecture?: string
  address?: string
  guardian_name?: string
  guardian_phone?: string
  guardian_attendance: boolean
  interested_course_id?: string
  visit_date_id: string
  remarks?: string
}

export interface Applicant extends ApplicantFormData {
  id: string
  tenant_id: string
  token: string | null
  token_expires_at: string | null
  line_user_id: string | null
  status: 'pending' | 'completed' | 'expired'
  created_at: string
  updated_at: string
}
