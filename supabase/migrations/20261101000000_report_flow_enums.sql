-- Commit enum additions before the following migrations use them.
alter type public.report_status add value if not exists 'closed';

create type public.report_review_outcome as enum ('pending', 'verified', 'linked', 'needs_assessment', 'could_not_confirm', 'rejected', 'outside_coverage');
create type public.report_jurisdiction_status as enum ('in_coverage', 'needs_check', 'outside_coverage');
create type public.report_intake_channel as enum ('resident_app', 'official_field', 'hotline_call');
create type public.incident_verification as enum ('pending', 'confirmed', 'not_confirmed');
create type public.incident_state as enum ('active', 'resolved', 'closed');
create type public.incident_lead_office as enum ('barangay', 'municipal');
create type public.incident_coordination as enum ('local', 'support_requested', 'support_active', 'transfer_requested', 'municipal_lead');
create type public.incident_confirmation_basis as enum ('remote_evidence', 'field_assessment', 'official_observation', 'municipal_review', 'legacy');
create type public.support_request_kind as enum ('support', 'transfer');
create type public.support_request_status as enum ('requested', 'accepted', 'returned', 'cancelled');
create type public.update_request_status as enum ('open', 'acknowledged', 'answered', 'cancelled');

alter type public.notification_type add value if not exists 'report_review_started';
alter type public.notification_type add value if not exists 'report_rerouted';
alter type public.notification_type add value if not exists 'report_linked';
alter type public.notification_type add value if not exists 'report_not_confirmed';
alter type public.notification_type add value if not exists 'report_rejected';
alter type public.notification_type add value if not exists 'report_outside_coverage';
alter type public.notification_type add value if not exists 'report_forwarded';
alter type public.notification_type add value if not exists 'report_transfer_accepted';
alter type public.notification_type add value if not exists 'report_withdrawn';
alter type public.notification_type add value if not exists 'report_progress';
alter type public.notification_type add value if not exists 'incident_support_requested';
alter type public.notification_type add value if not exists 'incident_support_responded';
alter type public.notification_type add value if not exists 'mayor_update_requested';
alter type public.notification_type add value if not exists 'mayor_update_answered';
