create or replace function public.list_resident_report_timeline(p_report_id uuid)
returns table (occurred_at timestamptz,entry_type text,public_text text,responsible_office_label text)
language plpgsql stable security definer set search_path = '' as $$
declare report public.reports; initial_office text;
begin
  select * into report from public.reports
  where id = p_report_id and reporter_id = auth.uid() and public.has_active_profile();
  if not found then raise exception 'Report not found.' using errcode = '42501'; end if;
  select 'Brgy. ' || name || ' BDRRMO' into initial_office
  from public.barangays where id = report.barangay_id;

  return query
  with entries as (
    select report.created_at as at_time,'received'::text as kind,'Report received'::text as message,
      coalesce((select history.resident_responsible_office_label from public.report_status_history history
        where history.report_id = report.id and history.resident_responsible_office_label is not null
          and not exists (select 1 from public.report_status_history reroute
            where reroute.report_id = report.id and reroute.event_type in ('routing_changed','jurisdiction_checked')
              and reroute.created_at <= history.created_at)
        order by history.created_at,history.id limit 1),
        case when exists (select 1 from public.report_status_history reroute
          where reroute.report_id = report.id and reroute.event_type in ('routing_changed','jurisdiction_checked'))
          then 'Original office not recorded' else initial_office end,
        'Original office not recorded') as office
    union all
    select history.created_at,history.event_type,
      case history.event_type
        when 'review_claimed' then 'Review started'
        when 'review_taken_over' then 'Review taken over'
        when 'review_reopened' then 'Report reopened for review'
        when 'routing_changed' then history.detail->>'public_text'
        when 'jurisdiction_checked' then history.detail->>'public_text'
        when 'review_decided' then case history.detail->>'outcome'
          when 'verified' then 'Incident confirmed'
          when 'linked' then 'Report linked to an incident'
          when 'needs_assessment' then 'Field assessment started'
          when 'could_not_confirm' then 'Incident could not be confirmed'
          when 'rejected' then 'Report not accepted'
        end
      end,
      coalesce(history.resident_responsible_office_label,'Office at this time not recorded')
    from public.report_status_history history where history.report_id = report.id
      and history.event_type in ('review_claimed','review_taken_over','review_reopened','routing_changed','jurisdiction_checked','review_decided')
    union all
    select event.occurred_at,event.event_type,
      case event.event_type
        when 'incident_created' then case
          when event.details->>'basis' = 'official_observation' then 'Incident observed by an official'
          when event.details->>'legacy' = 'true' then coalesce(event.details->>'legacy_label','Incident carried over from the previous system')
          when event.details->>'decision' = 'needs_assessment' then 'Field assessment started'
          when event.details->>'decision' = 'verify' then 'Incident confirmed'
          else 'Officials opened an incident case'
        end
        when 'finding_recorded' then case when event.details->>'finding' = 'confirmed'
          then 'Incident confirmed by the responsible office' else 'Incident not confirmed' end
        when 'transfer_requested' then coalesce(event.details->>'public_text','Transfer requested; the barangay remains responsible until acceptance')
        when 'transfer_accepted' then 'Responsibility transferred to MITCOM'
        when 'request_returned' then 'Request returned; the barangay remains responsible'
        when 'support_requested' then 'Support requested from MITCOM'
        when 'support_accepted' then 'MITCOM support accepted; the barangay remains responsible'
        when 'request_cancelled' then 'Coordination request cancelled'
        when 'reopened' then 'Incident reopened'
        when 'dispatch_confirmed' then 'Responders dispatched'
        when 'responders_on_site' then 'Responders arrived'
        when 'assistance_given' then 'Assistance provided'
        when 'work_done' then 'Response work completed'
        when 'progress_update' then coalesce(event.details->>'text','Progress update posted')
        when 'resolved' then 'Incident resolved'
        when 'summary_added' then 'Outcome summary posted'
        when 'withdrawn' then coalesce(event.details->>'public_text','Incident correction posted')
      end,
      coalesce(event.resident_responsible_office_label,
        case when event.event_type = 'transfer_accepted' then 'MITCOM' else 'Office at this time not recorded' end)
    from public.incident_events event
    where event.incident_case_id = report.incident_case_id
      and event.occurred_at >= report.created_at
      and event.event_type in ('incident_created','finding_recorded','transfer_requested','transfer_accepted',
        'request_returned','support_requested','support_accepted','request_cancelled','reopened','resolved',
        'withdrawn','summary_added','progress_update','dispatch_confirmed','responders_on_site','assistance_given','work_done')
      and (event.event_type <> 'progress_update' or event.is_public)
      -- Review decisions already describe the case creation from the same transaction.
      and not (event.event_type = 'incident_created'
        and event.details->>'decision' in ('verify','needs_assessment')
        and exists (select 1 from public.incident_cases incident
          where incident.id = event.incident_case_id and incident.source_report_id = report.id)
        and exists (
          select 1 from public.report_status_history history
          where history.report_id = report.id and history.event_type = 'review_decided'
            and history.detail->>'outcome' = case event.details->>'decision'
              when 'verify' then 'verified' when 'needs_assessment' then 'needs_assessment' end
        ))
  )
  select entries.at_time,entries.kind,
    case when entries.kind in ('routing_changed','jurisdiction_checked','incident_created','transfer_requested',
        'transfer_accepted','request_returned','support_requested','support_accepted','request_cancelled')
      then regexp_replace(entries.message,'\m(MDRRMO|MDRMMO)\M','MITCOM','gi')
      else entries.message end,
    regexp_replace(entries.office,'\m(MDRRMO|MDRMMO)\M','MITCOM','gi') from entries
  where entries.message is not null order by entries.at_time,entries.kind;
end;
$$;
