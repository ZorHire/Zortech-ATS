import { Job, Candidate, JobApplication, Vendor, EmailCampaign, Client, DashboardStats } from '../types';

export const mockClients: Client[] = [
  { id: '11111111-1111-1111-1111-111111111111', name: 'TechCorp India', industry: 'Technology', tier: 'priority', city: 'Bangalore', country: 'India', primary_contact_name: 'Priya Sharma', primary_contact_email: 'priya@techcorp.in', sla_hours: 24, is_active: true, created_at: '2024-01-15T10:00:00Z' },
  { id: '22222222-2222-2222-2222-222222222222', name: 'FinServ Solutions', industry: 'Finance', tier: 'standard', city: 'Mumbai', country: 'India', primary_contact_name: 'Rahul Mehta', primary_contact_email: 'rahul@finserv.in', sla_hours: 48, is_active: true, created_at: '2024-02-10T10:00:00Z' },
  { id: '33333333-3333-3333-3333-333333333333', name: 'HealthTech Pvt Ltd', industry: 'Healthcare', tier: 'priority', city: 'Hyderabad', country: 'India', primary_contact_name: 'Anita Rao', primary_contact_email: 'anita@healthtech.in', sla_hours: 36, is_active: true, created_at: '2024-03-01T10:00:00Z' },
];

export const mockJobs: Job[] = [
  { id: '11111111-1111-1111-1111-111111111112', client_id: '11111111-1111-1111-1111-111111111111', title: 'Senior React Developer', department: 'Engineering', location: 'Bangalore', work_mode: 'hybrid', employment_type: 'full_time', experience_min: 4, experience_max: 8, salary_min: 1800000, salary_max: 2800000, currency: 'INR', headcount: 3, priority: 'critical', status: 'active', description: 'We are looking for a Senior React Developer...', mandatory_skills: ['React', 'TypeScript', 'Node.js'], preferred_skills: ['GraphQL', 'AWS', 'Docker'], created_at: '2024-03-10T09:00:00Z', updated_at: '2024-03-10T09:00:00Z', application_count: 24 },
  { id: '22222222-2222-2222-2222-222222222223', client_id: '22222222-2222-2222-2222-222222222222', title: 'Python ML Engineer', department: 'Data Science', location: 'Mumbai', work_mode: 'remote', employment_type: 'full_time', experience_min: 3, experience_max: 7, salary_min: 1500000, salary_max: 2500000, currency: 'INR', headcount: 2, priority: 'high', status: 'active', description: 'Build and deploy ML models...', mandatory_skills: ['Python', 'TensorFlow', 'PyTorch'], preferred_skills: ['MLOps', 'Kubernetes', 'Spark'], created_at: '2024-03-08T09:00:00Z', updated_at: '2024-03-08T09:00:00Z', application_count: 18 },
  { id: '33333333-3333-3333-3333-333333333334', client_id: '33333333-3333-3333-3333-333333333333', title: 'Product Manager - HealthTech', department: 'Product', location: 'Hyderabad', work_mode: 'onsite', employment_type: 'full_time', experience_min: 5, experience_max: 10, salary_min: 2000000, salary_max: 3500000, currency: 'INR', headcount: 1, priority: 'high', status: 'active', description: 'Lead product strategy for health platform...', mandatory_skills: ['Product Strategy', 'Agile', 'Data Analysis'], preferred_skills: ['Healthcare Domain', 'SQL'], created_at: '2024-03-05T09:00:00Z', updated_at: '2024-03-05T09:00:00Z', application_count: 12 },
  { id: '44444444-4444-4444-4444-444444444444', client_id: '11111111-1111-1111-1111-111111111111', title: 'DevOps Engineer', department: 'Infrastructure', location: 'Bangalore', work_mode: 'hybrid', employment_type: 'full_time', experience_min: 3, experience_max: 6, salary_min: 1400000, salary_max: 2200000, currency: 'INR', headcount: 2, priority: 'medium', status: 'pending_review', description: 'Manage cloud infrastructure and CI/CD pipelines...', mandatory_skills: ['Kubernetes', 'AWS', 'Terraform'], preferred_skills: ['Prometheus', 'Grafana'], created_at: '2024-03-12T09:00:00Z', updated_at: '2024-03-12T09:00:00Z', application_count: 7 },
  { id: '55555555-5555-5555-5555-555555555555', client_id: '22222222-2222-2222-2222-222222222222', title: 'Java Backend Engineer', department: 'Engineering', location: 'Mumbai', work_mode: 'hybrid', employment_type: 'full_time', experience_min: 2, experience_max: 5, salary_min: 900000, salary_max: 1600000, currency: 'INR', headcount: 5, priority: 'medium', status: 'on_hold', description: 'Build scalable backend services...', mandatory_skills: ['Java', 'Spring Boot', 'PostgreSQL'], preferred_skills: ['Kafka', 'Redis', 'Microservices'], created_at: '2024-02-20T09:00:00Z', updated_at: '2024-02-20T09:00:00Z', application_count: 31 },
  { id: '66666666-6666-6666-6666-666666666666', client_id: '33333333-3333-3333-3333-333333333333', title: 'UI/UX Designer', department: 'Design', location: 'Hyderabad', work_mode: 'remote', employment_type: 'full_time', experience_min: 2, experience_max: 5, salary_min: 800000, salary_max: 1400000, currency: 'INR', headcount: 1, priority: 'low', status: 'closed_filled', description: 'Create beautiful user interfaces...', mandatory_skills: ['Figma', 'User Research', 'Prototyping'], preferred_skills: ['React', 'CSS'], created_at: '2024-01-25T09:00:00Z', updated_at: '2024-01-25T09:00:00Z', application_count: 45 },
];

export const mockCandidates: Candidate[] = [
  { id: 'c-001', first_name: 'Arjun', last_name: 'Sharma', email: 'arjun.sharma@email.com', phone: '+91-9876543210', current_title: 'Senior Frontend Developer', current_company: 'Infosys', experience_years: 6, current_location: 'Bangalore', preferred_location: 'Bangalore', notice_period_days: 30, current_ctc: 1600000, expected_ctc: 2200000, skills: ['React', 'TypeScript', 'Node.js', 'GraphQL', 'AWS'], summary: 'Experienced frontend developer with strong React skills.', source: 'linkedin', gdpr_consent: true, is_active: true, created_at: '2024-03-11T10:00:00Z', updated_at: '2024-03-11T10:00:00Z' },
  { id: 'c-002', first_name: 'Priya', last_name: 'Nair', email: 'priya.nair@email.com', phone: '+91-9876543211', current_title: 'ML Engineer', current_company: 'Flipkart', experience_years: 4, current_location: 'Bangalore', preferred_location: 'Mumbai, Remote', notice_period_days: 45, current_ctc: 1400000, expected_ctc: 1900000, skills: ['Python', 'TensorFlow', 'PyTorch', 'MLOps', 'Docker'], summary: 'Passionate ML engineer with experience in production deployments.', source: 'naukri', gdpr_consent: true, is_active: true, created_at: '2024-03-09T10:00:00Z', updated_at: '2024-03-09T10:00:00Z' },
  { id: 'c-003', first_name: 'Rohit', last_name: 'Verma', email: 'rohit.verma@email.com', phone: '+91-9876543212', current_title: 'Product Manager', current_company: 'Paytm', experience_years: 7, current_location: 'Delhi', preferred_location: 'Hyderabad, Bangalore', notice_period_days: 60, current_ctc: 2200000, expected_ctc: 3000000, skills: ['Product Strategy', 'Agile', 'Data Analysis', 'SQL', 'Stakeholder Management'], summary: 'Strategic PM with fintech and healthtech background.', source: 'referral', gdpr_consent: true, is_active: true, created_at: '2024-03-07T10:00:00Z', updated_at: '2024-03-07T10:00:00Z' },
  { id: 'c-004', first_name: 'Kavya', last_name: 'Reddy', email: 'kavya.reddy@email.com', phone: '+91-9876543213', current_title: 'DevOps Engineer', current_company: 'TCS', experience_years: 4, current_location: 'Hyderabad', preferred_location: 'Bangalore', notice_period_days: 30, current_ctc: 1100000, expected_ctc: 1700000, skills: ['Kubernetes', 'AWS', 'Terraform', 'Docker', 'Jenkins'], summary: 'DevOps engineer with cloud infrastructure expertise.', source: 'indeed', gdpr_consent: true, is_active: true, created_at: '2024-03-13T10:00:00Z', updated_at: '2024-03-13T10:00:00Z' },
  { id: 'c-005', first_name: 'Sameer', last_name: 'Khan', email: 'sameer.khan@email.com', phone: '+91-9876543214', current_title: 'Java Developer', current_company: 'Wipro', experience_years: 3, current_location: 'Pune', preferred_location: 'Mumbai', notice_period_days: 30, current_ctc: 800000, expected_ctc: 1200000, skills: ['Java', 'Spring Boot', 'PostgreSQL', 'REST APIs', 'Microservices'], summary: 'Backend developer with solid Java expertise.', source: 'vendor', gdpr_consent: true, is_active: true, created_at: '2024-03-06T10:00:00Z', updated_at: '2024-03-06T10:00:00Z' },
  { id: 'c-006', first_name: 'Ananya', last_name: 'Mishra', email: 'ananya.mishra@email.com', phone: '+91-9876543215', current_title: 'UI/UX Designer', current_company: 'Zomato', experience_years: 3, current_location: 'Hyderabad', preferred_location: 'Hyderabad, Remote', notice_period_days: 15, current_ctc: 900000, expected_ctc: 1300000, skills: ['Figma', 'User Research', 'Prototyping', 'CSS', 'Design Systems'], summary: 'Creative designer with product thinking.', source: 'direct', gdpr_consent: true, is_active: true, created_at: '2024-03-04T10:00:00Z', updated_at: '2024-03-04T10:00:00Z' },
  { id: 'c-007', first_name: 'Vikram', last_name: 'Gupta', email: 'vikram.gupta@email.com', phone: '+91-9876543216', current_title: 'Full Stack Developer', current_company: 'Amazon', experience_years: 5, current_location: 'Bangalore', preferred_location: 'Bangalore', notice_period_days: 90, current_ctc: 1800000, expected_ctc: 2500000, skills: ['React', 'Node.js', 'AWS', 'PostgreSQL', 'Redis'], summary: 'Full stack developer with strong AWS expertise.', source: 'linkedin', gdpr_consent: true, is_active: true, created_at: '2024-03-15T10:00:00Z', updated_at: '2024-03-15T10:00:00Z' },
  { id: 'c-008', first_name: 'Sneha', last_name: 'Iyer', email: 'sneha.iyer@email.com', phone: '+91-9876543217', current_title: 'Data Scientist', current_company: 'Swiggy', experience_years: 3, current_location: 'Chennai', preferred_location: 'Mumbai, Remote', notice_period_days: 30, current_ctc: 1200000, expected_ctc: 1800000, skills: ['Python', 'Spark', 'SQL', 'Machine Learning', 'Pandas'], summary: 'Data scientist with strong analytics background.', source: 'naukri', gdpr_consent: true, is_active: true, created_at: '2024-03-14T10:00:00Z', updated_at: '2024-03-14T10:00:00Z' },
];

export const mockApplications: JobApplication[] = [
  { id: 'app-001', job_id: '11111111-1111-1111-1111-111111111112', candidate_id: 'c-001', stage: 'shortlisted', ai_score: 92, ai_match_breakdown: { skills: 95, experience: 90, location: 100, education: 85 }, created_at: '2024-03-11T11:00:00Z', updated_at: '2024-03-12T10:00:00Z' },
  { id: 'app-002', job_id: '11111111-1111-1111-1111-111111111112', candidate_id: 'c-007', stage: 'screened', ai_score: 87, ai_match_breakdown: { skills: 90, experience: 85, location: 100, education: 80 }, created_at: '2024-03-15T11:00:00Z', updated_at: '2024-03-15T14:00:00Z' },
  { id: 'app-003', job_id: '22222222-2222-2222-2222-222222222223', candidate_id: 'c-002', stage: 'submitted_to_client', ai_score: 89, ai_match_breakdown: { skills: 92, experience: 88, location: 80, education: 90 }, created_at: '2024-03-09T11:00:00Z', updated_at: '2024-03-11T09:00:00Z' },
  { id: 'app-004', job_id: '22222222-2222-2222-2222-222222222223', candidate_id: 'c-008', stage: 'new', ai_score: 74, ai_match_breakdown: { skills: 78, experience: 72, location: 70, education: 85 }, created_at: '2024-03-14T11:00:00Z', updated_at: '2024-03-14T11:00:00Z' },
  { id: 'app-005', job_id: '33333333-3333-3333-3333-333333333334', candidate_id: 'c-003', stage: 'client_interview_scheduled', ai_score: 91, ai_match_breakdown: { skills: 88, experience: 95, location: 85, education: 90 }, created_at: '2024-03-07T11:00:00Z', updated_at: '2024-03-10T09:00:00Z' },
  { id: 'app-006', job_id: '44444444-4444-4444-4444-444444444444', candidate_id: 'c-004', stage: 'sourced', ai_score: 83, ai_match_breakdown: { skills: 85, experience: 82, location: 90, education: 75 }, created_at: '2024-03-13T11:00:00Z', updated_at: '2024-03-13T11:00:00Z' },
  { id: 'app-007', job_id: '55555555-5555-5555-5555-555555555555', candidate_id: 'c-005', stage: 'offer_extended', ai_score: 79, ai_match_breakdown: { skills: 82, experience: 78, location: 90, education: 70 }, created_at: '2024-03-06T11:00:00Z', updated_at: '2024-03-12T15:00:00Z' },
  { id: 'app-008', job_id: '66666666-6666-6666-6666-666666666666', candidate_id: 'c-006', stage: 'offer_accepted', ai_score: 95, ai_match_breakdown: { skills: 98, experience: 90, location: 100, education: 95 }, created_at: '2024-03-04T11:00:00Z', updated_at: '2024-03-10T16:00:00Z' },
];

export const mockVendors: Vendor[] = [
  { id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', company_name: 'TalentBridge Staffing', primary_contact_name: 'Karan Patel', primary_contact_email: 'karan@talentbridge.in', primary_contact_phone: '+91-9900001111', industry_specializations: ['Technology', 'Finance'], geographies: ['Bangalore', 'Mumbai', 'Hyderabad'], tier: 'preferred', quality_score: 87, submission_count: 142, shortlist_rate: 34, fill_rate: 12, sla_adherence: 94, is_active: true, created_at: '2023-10-01T10:00:00Z', updated_at: '2024-03-01T10:00:00Z' },
  { id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', company_name: 'HireRight Solutions', primary_contact_name: 'Deepa Nair', primary_contact_email: 'deepa@hireright.in', primary_contact_phone: '+91-9900002222', industry_specializations: ['Healthcare', 'Technology'], geographies: ['Mumbai', 'Pune', 'Delhi'], tier: 'standard', quality_score: 72, submission_count: 89, shortlist_rate: 24, fill_rate: 8, sla_adherence: 78, is_active: true, created_at: '2023-11-15T10:00:00Z', updated_at: '2024-02-15T10:00:00Z' },
  { id: 'cccccccc-cccc-cccc-cccc-cccccccccccc', company_name: 'PeopleFirst Agency', primary_contact_name: 'Suresh Kumar', primary_contact_email: 'suresh@peoplefirst.in', primary_contact_phone: '+91-9900003333', industry_specializations: ['Finance', 'BFSI'], geographies: ['Chennai', 'Hyderabad'], tier: 'standard', quality_score: 65, submission_count: 56, shortlist_rate: 18, fill_rate: 5, sla_adherence: 70, is_active: true, created_at: '2024-01-10T10:00:00Z', updated_at: '2024-02-10T10:00:00Z' },
  { id: 'dddddddd-dddd-dddd-dddd-dddddddddddd', company_name: 'TechTalent Hub', primary_contact_name: 'Meena Pillai', primary_contact_email: 'meena@techtalenthub.in', primary_contact_phone: '+91-9900004444', industry_specializations: ['Technology', 'Startups'], geographies: ['Bangalore', 'Pune'], tier: 'blocked', quality_score: 41, submission_count: 23, shortlist_rate: 9, fill_rate: 2, sla_adherence: 52, is_active: false, created_at: '2024-02-01T10:00:00Z', updated_at: '2024-03-05T10:00:00Z' },
];

export const mockCampaigns: EmailCampaign[] = [
  { id: 'camp-001', name: 'React Developers Outreach - March', subject: 'Exciting Senior React Developer Opportunity at TechCorp', body: '<p>Dear {{FirstName}},</p><p>We have an exciting opportunity...</p>', status: 'sent', recipient_count: 450, delivered_count: 432, opened_count: 187, clicked_count: 64, bounced_count: 18, unsubscribed_count: 4, sent_at: '2024-03-11T09:00:00Z', created_at: '2024-03-10T14:00:00Z', updated_at: '2024-03-11T09:00:00Z' },
  { id: 'camp-002', name: 'ML Engineers Database Blast', subject: 'ML Engineer Roles - Multiple Openings', body: '<p>Dear {{FirstName}},</p><p>We have multiple ML positions...</p>', status: 'sent', recipient_count: 280, delivered_count: 271, opened_count: 134, clicked_count: 47, bounced_count: 9, unsubscribed_count: 2, sent_at: '2024-03-09T10:00:00Z', created_at: '2024-03-08T16:00:00Z', updated_at: '2024-03-09T10:00:00Z' },
  { id: 'camp-003', name: 'Product Manager Outreach Q1', subject: 'Senior PM Role - HealthTech Startup', body: '<p>Dear {{FirstName}},</p><p>Are you a seasoned PM...</p>', status: 'scheduled', recipient_count: 120, delivered_count: 0, opened_count: 0, clicked_count: 0, bounced_count: 0, unsubscribed_count: 0, scheduled_at: '2024-03-16T09:00:00Z', created_at: '2024-03-14T11:00:00Z', updated_at: '2024-03-14T11:00:00Z' },
  { id: 'camp-004', name: 'Java Developers - Q2 Pipeline', subject: 'Backend Java Engineer - Exciting FinTech Role', body: '<p>Dear {{FirstName}},</p><p>We are building an exciting team...</p>', status: 'draft', recipient_count: 0, delivered_count: 0, opened_count: 0, clicked_count: 0, bounced_count: 0, unsubscribed_count: 0, created_at: '2024-03-15T15:00:00Z', updated_at: '2024-03-15T15:00:00Z' },
];

export const mockDashboardStats: DashboardStats = {
  activeJobs: 8,
  totalCandidates: 1247,
  scheduledInterviews: 14,
  offersExtended: 3,
  slaBreaches: 2,
  newApplicationsToday: 23,
};

export const pipelineStageLabels: Record<string, string> = {
  new: 'New',
  sourced: 'Sourced',
  screened: 'Screened',
  shortlisted: 'Shortlisted',
  submitted_to_client: 'Submitted to Client',
  client_interview_scheduled: 'Interview Scheduled',
  interview_completed: 'Interview Completed',
  selected: 'Selected',
  offer_extended: 'Offer Extended',
  offer_accepted: 'Offer Accepted',
  offer_rejected: 'Offer Rejected',
  joined: 'Joined',
  disqualified: 'Disqualified',
};

export const jobStatusLabels: Record<string, string> = {
  draft: 'Draft',
  pending_review: 'Pending Review',
  active: 'Active',
  on_hold: 'On Hold',
  closed_filled: 'Closed - Filled',
  closed_cancelled: 'Closed - Cancelled',
  expired: 'Expired',
};
