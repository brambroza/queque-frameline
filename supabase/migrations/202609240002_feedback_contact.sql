-- Feedback reports: contact details typed by the reporter (reply address,
-- extra CC recipients, phone for a call-back). `reporter_email` stays the
-- sign-in address from the session; `contact_email` is what they asked us to
-- reply to.

alter table public.feedback_reports
  add column if not exists contact_email text,
  add column if not exists contact_phone text,
  add column if not exists cc_emails text[] not null default '{}';

comment on column public.feedback_reports.contact_email is 'Reply-to address entered in the form (defaults to the sign-in e-mail).';
comment on column public.feedback_reports.cc_emails is 'Extra recipients the reporter asked to copy on the e-mail (comma-separated in the form).';
comment on column public.feedback_reports.contact_phone is 'Phone number for a call-back, as typed.';
