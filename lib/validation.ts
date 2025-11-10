import { z } from 'zod'

export const applicantSchema = z.object({
  name: z.string().min(1, '氏名を入力してください').max(100),
  kana_name: z.string().max(100).optional(),
  email: z.string().email('有効なメールアドレスを入力してください'),
  phone: z.string()
    .regex(/^[0-9-]+$/, '電話番号は数字とハイフンのみ使用できます')
    .min(10)
    .max(20),
  school_name: z.string().min(1, '学校名を入力してください').max(200),
  school_type: z.string().optional(),
  grade: z.string().min(1, '学年を選択してください'),
  graduation_year: z.number().optional(),
  postal_code: z.string().max(10).optional(),
  prefecture: z.string().max(20).optional(),
  address: z.string().optional(),
  guardian_name: z.string().max(100).optional(),
  guardian_phone: z.string().max(20).optional(),
  guardian_attendance: z.boolean(),
  interested_course_id: z.string().uuid().optional(),
  visit_date_id: z.string().uuid('有効な日程を選択してください'),
  remarks: z.string().optional(),
})
