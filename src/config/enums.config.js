// src/config/enums.config.js

module.exports = {
  // ============================================================
  // USER & STAFF ENUMS
  // ============================================================
  USER_ROLES: {
    SUPERADMIN: 'superadmin',
    ADMIN_OFFICE: 'admin_office',
    TEACHER: 'teacher',
    STUDENT: 'student',
    ALL: ['superadmin', 'admin_office', 'teacher', 'student']
  },

  STAFF_ROLES: {
    SUPERADMIN: 'superadmin',
    ADMIN_OFFICE: 'admin_office',
    TEACHER: 'teacher',
    ALL: ['superadmin', 'admin_office', 'teacher']
  },

  STUDENT_STATUSES: {
    ACTIVE: 'active',
    PASSOUT: 'passout',
    LEFT: 'left',
    ALL: ['active', 'passout', 'left']
  },

  // ============================================================
  // ATTENDANCE ENUMS
  // ============================================================
  ATTENDANCE_STATUSES: {
    PRESENT: 'present',
    ABSENT: 'absent',
    LEAVE: 'leave',
    ALL: ['present', 'absent', 'leave']
  },

  // ============================================================
  // FEE ENUMS
  // ============================================================
  FEE_COMPONENT_CATEGORIES: {
    TUITION: 'tuition',
    TRANSPORT: 'transport',
    LIBRARY: 'library',
    MAINTENANCE: 'maintenance',
    EXAMINATION: 'examination',
    FINE: 'fine',
    HOSTEL: 'hostel',
    ACTIVITY: 'activity',
    OTHER: 'other',
    ALL: ['tuition', 'transport', 'library', 'maintenance', 'examination', 'fine', 'hostel', 'activity', 'other']
  },

  FEE_COMPONENT_BILLING_TYPES: {
    MONTHLY: 'monthly',
    ONE_TIME: 'one_time',
    ANNUAL: 'annual',
    MANUAL: 'manual',
    ALL: ['monthly', 'one_time', 'annual', 'manual']
  },

  FEE_COMPONENT_STATUSES: {
    ACTIVE: 'active',
    INACTIVE: 'inactive',
    ALL: ['active', 'inactive']
  },

  FEE_DETAIL_STATUSES: {
    PENDING: 'pending',
    SUBMITTED: 'submitted',
    PARTIALLY_PAID: 'partially_paid',
    PAID: 'paid',
    REJECTED: 'rejected',
    ALL: ['pending', 'submitted', 'partially_paid', 'paid', 'rejected']
  },

  FEE_PAYMENT_STATUSES: {
    SUBMITTED: 'submitted',
    APPROVED: 'approved',
    REJECTED: 'rejected',
    ALL: ['submitted', 'approved', 'rejected']
  },

  DISCOUNT_TYPES: {
    PERCENTAGE: 'percentage',
    FIXED: 'fixed',
    ALL: ['percentage', 'fixed']
  },

  // ============================================================
  // EXPENSE ENUMS
  // ============================================================
  EXPENSE_CATEGORIES: {
    SALARY: 'salary',
    UTILITIES: 'utilities',
    MAINTENANCE: 'maintenance',
    SUPPLIES: 'supplies',
    EQUIPMENT: 'equipment',
    MARKETING: 'marketing',
    TRANSPORT: 'transport',
    FOOD: 'food',
    EVENTS: 'events',
    INSURANCE: 'insurance',
    TAXES: 'taxes',
    RENT: 'rent',
    PROFESSIONAL_SERVICES: 'professional_services',
    TECHNOLOGY: 'technology',
    TRAINING: 'training',
    OTHER: 'other',
    ALL: [
      'salary', 'utilities', 'maintenance', 'supplies', 'equipment',
      'marketing', 'transport', 'food', 'events', 'insurance',
      'taxes', 'rent', 'professional_services', 'technology',
      'training', 'other'
    ]
  },

  EXPENSE_STATUSES: {
    PENDING: 'pending',
    APPROVED: 'approved',
    PAID: 'paid',
    CANCELLED: 'cancelled',
    ALL: ['pending', 'approved', 'paid', 'cancelled']
  },

  // ============================================================
  // EXAM ENUMS
  // ============================================================
  EXAM_TYPES: {
    MIDTERM: 'midterm',
    MIDTERM2: 'midterm2',
    FINAL: 'final',
    QUIZ: 'quiz',
    TEST: 'test',
    ALL: ['midterm', 'midterm2', 'final', 'quiz', 'test']
  },

  EXAM_STATUSES: {
    SCHEDULED: 'scheduled',
    ONGOING: 'ongoing',
    COMPLETED: 'completed',
    CANCELLED: 'cancelled',
    ALL: ['scheduled', 'ongoing', 'completed', 'cancelled']
  },

  // ============================================================
  // RESULT ENUMS
  // ============================================================
  RESULT_EXAM_TYPES: {
    MIDTERM: 'midterm',
    MIDTERM2: 'midterm2',
    FINAL: 'final',
    ALL: ['midterm', 'midterm2', 'final']
  },

  RESULT_GRADES: {
    A_PLUS: 'A+',
    A: 'A',
    B: 'B',
    C: 'C',
    D: 'D',
    F: 'F',
    ALL: ['A+', 'A', 'B', 'C', 'D', 'F']
  },

  // ============================================================
  // LEAVE ENUMS
  // ============================================================
  LEAVE_USER_TYPES: {
    STUDENT: 'student',
    TEACHER: 'teacher',
    STAFF: 'staff',
    ALL: ['student', 'teacher', 'staff']
  },

  LEAVE_TYPES: {
    SICK: 'sick',
    CASUAL: 'casual',
    ANNUAL: 'annual',
    EMERGENCY: 'emergency',
    ALL: ['sick', 'casual', 'annual', 'emergency']
  },

  LEAVE_STATUSES: {
    PENDING: 'pending',
    APPROVED: 'approved',
    REJECTED: 'rejected',
    CANCELLED: 'cancelled',
    ALL: ['pending', 'approved', 'rejected', 'cancelled']
  },

  // ============================================================
  // SCHEDULE ENUMS
  // ============================================================
  SCHEDULE_TYPES: {
    SUBJECT: 'subject',
    BREAK: 'break',
    HOLIDAY: 'holiday',
    ALL: ['subject', 'break', 'holiday']
  },

  DAYS: {
    MONDAY: 'Monday',
    TUESDAY: 'Tuesday',
    WEDNESDAY: 'Wednesday',
    THURSDAY: 'Thursday',
    FRIDAY: 'Friday',
    SATURDAY: 'Saturday',
    SUNDAY: 'Sunday',
    ALL: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
  },

  // ============================================================
  // SALARY SLIP ENUMS
  // ============================================================
  SALARY_SLIP_STATUSES: {
    PENDING: 'pending',
    PARTIAL: 'partial',
    PAID: 'paid',
    ALL: ['pending', 'partial', 'paid']
  },

  // ============================================================
  // PAYMENT METHOD ENUMS
  // ============================================================
  PAYMENT_METHODS: {
    CASH: 'cash',
    BANK: 'bank',
    ALL: ['cash', 'bank']
  },

  // ============================================================
  // VIDEO ENUMS
  // ============================================================
  VIDEO_PLATFORMS: {
    YOUTUBE: 'youtube',
    INSTAGRAM: 'instagram',
    TIKTOK: 'tiktok',
    FACEBOOK: 'facebook',
    TWITTER: 'twitter',
    LINKEDIN: 'linkedin',
    ALL: ['youtube', 'instagram', 'tiktok', 'facebook', 'twitter', 'linkedin']
  },

  VIDEO_CATEGORIES: {
    ANIMAL: 'Animal',
    FUN: 'Fun',
    CARTOONS: 'Cartoons',
    YUSHAY_STARS: 'Yushay Stars',
    AI_POEMS: 'AI Poems',
    ENGLISH_LEARNING: 'English learning',
    ISLAMIC_STUDIES: 'Islamic Studies',
    HEALTH_AND_FOOD: 'Health and Food',
    ALL: ['Animal', 'Fun', 'Cartoons', 'Yushay Stars', 'AI Poems', 'English learning', 'Islamic Studies', 'Health and Food']
  },

  VIDEO_STATUSES: {
    ACTIVE: 'active',
    INACTIVE: 'inactive',
    ALL: ['active', 'inactive']
  },

  // ============================================================
  // PROJECT ENUMS
  // ============================================================
  PROJECT_TARGET_TYPES: {
    SECTION: 'section',
    STUDENTS: 'students',
    ALL: ['section', 'students']
  },

  PROJECT_STATUSES: {
    DRAFT: 'draft',
    ASSIGNED: 'assigned',
    COMPLETED: 'completed',
    GRADED: 'graded',
    ALL: ['draft', 'assigned', 'completed', 'graded']
  },

  SUBMISSION_STATUSES: {
    PENDING: 'pending',
    SUBMITTED: 'submitted',
    GRADED: 'graded',
    REJECTED: 'rejected',
    RESUBMIT: 'resubmit',
    ALL: ['pending', 'submitted', 'graded', 'rejected', 'resubmit']
  },

  // ============================================================
  // QUIZ ENUMS
  // ============================================================
  QUIZ_STATUSES: {
    DRAFT: 'draft',
    PUBLISHED: 'published',
    ARCHIVED: 'archived',
    ALL: ['draft', 'published', 'archived']
  },

  QUIZ_QUESTION_TYPES: {
    MCQ: 'mcq',
    FILL: 'fill',
    ALL: ['mcq', 'fill']
  },

  // ============================================================
  // NOTICE ENUMS
  // ============================================================
  NOTICE_TARGETS: {
    ALL_TEACHERS: 'all_teachers',
    SELECTED_TEACHERS: 'selected_teachers',
    ALL_STUDENTS: 'all_students',
    SELECTED_STUDENTS: 'selected_students',
    ALL: 'all',
    CUSTOM: 'custom',
    CLASS: 'class',
    ADMIN: 'admin',
    ALL: ['all_teachers', 'selected_teachers', 'all_students', 'selected_students', 'all', 'custom', 'class', 'admin']
  },

  NOTICE_CATEGORIES: {
    NOTICE: 'notice',
    MEETING: 'meeting',
    HOLIDAY: 'holiday',
    GENERAL: 'general',
    ALL: ['notice', 'meeting', 'holiday', 'general']
  },

  // ============================================================
  // COMPLAINT FEEDBACK ENUMS
  // ============================================================
  COMPLAINT_FEEDBACK_TYPES: {
    COMPLAINT: 'complaint',
    FEEDBACK: 'feedback',
    ALL: ['complaint', 'feedback']
  },

  COMPLAINT_FEEDBACK_STATUSES: {
    PENDING: 'pending',
    REVIEWED: 'reviewed',
    RESOLVED: 'resolved',
    SUBMITTED: 'submitted',
    ADDRESSED: 'addressed',
    ALL: ['pending', 'reviewed', 'resolved', 'submitted', 'addressed']
  },

  // ============================================================
  // EVENT ENUMS
  // ============================================================
  EVENT_STATUSES: {
    UPCOMING: 'upcoming',
    COMPLETED: 'completed',
    ALL: ['upcoming', 'completed']
  },

  // ============================================================
  // SLIDER IMAGE ENUMS
  // ============================================================
  SLIDER_CATEGORIES: {
    GLOBAL: 'global',
    EVENT: 'event',
    NOTICE: 'notice',
    GENERAL: 'general',
    ALL: ['global', 'event', 'notice', 'general']
  },

  UPLOADED_BY_ROLES: {
    SUPERADMIN: 'superadmin',
    ADMIN_OFFICE: 'admin_office',
    SCHOOL: 'school',
    ALL: ['superadmin', 'admin_office', 'school']
  },

  // ============================================================
  // SCHOOL MEDIA ENUMS
  // ============================================================
  SCHOOL_MEDIA_TYPES: {
    VIDEO: 'video',
    REEL: 'reel',
    ALL: ['video', 'reel']
  },

  SCHOOL_MEDIA_VISIBILITY: {
    PUBLIC: 'public',
    SCHOOL_ONLY: 'school-only',
    ALL: ['public', 'school-only']
  },

  // ============================================================
  // DOCUMENT ENUMS
  // ============================================================
  DOCUMENT_REQUEST_TYPES: {
    DOCUMENT: 'document',
    QUESTION: 'question',
    DATA: 'data',
    ALL: ['document', 'question', 'data']
  },

  DOCUMENT_TYPES: {
    ASSIGNMENT: 'assignment',
    HOMEWORK: 'homework',
    CERTIFICATE: 'certificate',
    FORM: 'form',
    REPORT: 'report',
    OTHER: 'other',
    ALL: ['assignment', 'homework', 'certificate', 'form', 'report', 'other']
  },

  DOCUMENT_STATUSES: {
    PENDING: 'pending',
    UPLOADED: 'uploaded',
    REVIEWED: 'reviewed',
    APPROVED: 'approved',
    REJECTED: 'rejected',
    EXPIRED: 'expired',
    SUBMITTED: 'submitted',
    ALL: ['pending', 'uploaded', 'reviewed', 'approved', 'rejected', 'expired', 'submitted']
  },

  REQUESTED_BY_MODELS: {
    USER: 'User',
    SCHOOL: 'School',
    STAFF: 'Staff',
    ALL: ['User', 'School', 'Staff']
  },

  // ============================================================
  // SYLLABUS ENUMS
  // ============================================================
  SYLLABUS_STATUSES: {
    DRAFT: 'draft',
    PUBLISHED: 'published',
    ARCHIVED: 'archived',
    ALL: ['draft', 'published', 'archived']
  },

  // ============================================================
  // COMMON STATUSES
  // ============================================================
  COMMON_STATUSES: {
    ACTIVE: 'active',
    INACTIVE: 'inactive',
    ALL: ['active', 'inactive']
  },
};