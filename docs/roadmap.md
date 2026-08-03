 # MDRRMO Operational MVP Implementation Plan                                    
                                                                                  
  ## Summary                                                                      
                                                                                  
  Use docs/SOL.md as the authoritative project assessment alongside the current   
  Supabase migrations and MDRRMO implementation.                                  
                                                                                  
  Preserve the modern Command-screen design across the portal: rounded cards,     
  soft shadows, generous spacing, restrained colors, clear hierarchy, and         
  progressive disclosure.                                                         
                                                                                  
  Current gaps confirmed by the document and code:                                
                                                                                  
  - Hotline, facility, and center creation forms are permanently expanded.        
  - Facilities and centers require manual coordinates.                            
  - Hotlines already support an optional facility relationship, but the UI does   
    not expose it.
                                                                                  
  - Resources is hidden inside MDRRMO Community.                                  
  - Center status only tracks open/full/closed, capacity, and priority.           
  - Command’s evacuation summary lacks occupancy, stale updates, capability       
    warnings, and actionable center information.                                  
                                                                                  
  - Settings only provides identity, scope, and logout.                           
  - Notifications have database foundations but no inbox, push worker, or         
    delivery evidence.                                                            
                                                                                  
  - Citizen reports are treated as incidents instead of immutable observations    
    linked to operational incidents.                                              
                                                                                  
  - Suspended-account enforcement, map validation, audit coverage, exports, and   
    automated tests remain incomplete.                                            
                                                                                  
  ## Target MDRRMO Structure                                                      
                                                                                  
  Use these bottom navigation destinations:
                                                                                  
  1. Command                                                                      
  2. Incidents                                                                    
  3. Community                                                                    
  4. Map                                                                          
  5. Resources                                                                    
                                                                                  
  Open Settings through the profile avatar. Remove the Community/Resources icon   
  switch and the MDRRMO Resources redirect.                                       
                                                                                  
  Keep the resource tables separate:                                              
                                                                                  
  - A facility can have multiple hotlines.                                        
  - A hotline can optionally belong to a facility.                                
  - An evacuation center can optionally reference a facility while retaining      
    separate permissions and operational records.                                 
                                                                                  
  - Facilities and centers require a map-selected point; address or landmark      
    text is optional.                                                             

  - Evacuee information remains aggregate-only, with no named individual or       
    household registry.                                                           
                                                                                  
  ## Data and Interface Changes                                                   
                                                                                  
  ### Directory data
                                                                                  
  Extend hotlines with:                                                           
                                                                                  
  - Optional facility_id using the existing relationship.                         
  - Authority or owning office.                                                   
  - Operating hours.                                                              
  - Alternate contact/channel.                                                    
  - Existing active and verification metadata.                                    
                                                                                  
  Extend facilities with:                                                         
                                                                                  
  - Operating status: operational, limited, temporarily_closed, or unknown.       
  - Authority, operating hours, services, and accessibility features.             
  - Data steward.                                                                 
  - Existing location, address, contact, active, and verification metadata.       
                                                                                  
  Create append-only directory events for create, update, archive/reactivate,     
  relink, and verification actions.                                               
                                                                                  
  ### Evacuation centers                                                          
                                                                                  
  Add:                                                                            
                                                                                  
  - Optional facility link and address/landmark.                                  
  - Operating state: standby, open, or closed.                                    
  - People capacity, assigned manager, public directions, archive state,          
    priority reason, setter, and timestamp.                                       
                                                                                  
  - Append-only status updates containing current people/families, aggregate      
    vulnerable-group counts, capability states, notes, actor, and time.           
                                                                                  
  Use a latest-status view to derive:                                             
                                                                                  
  - Occupancy percentage.                                                         
  - available, near_capacity, full, or unknown.                                   
  - Near capacity at 80%.                                                         
  - Stale status after two hours without an update while open.                    
                                                                                  
  Keep public-safe center fields separate from restricted internal and            
  vulnerable-group summaries.                                                     
                                                                                  
  ### Incident operations                                                         
                                                                                  
  Introduce:                                                                      
                                                                                  
  - incidents.                                                                    
  - incident_report_links.                                                        
  - incident_assignments.                                                         
  - incident_actions.                                                             
  - Immutable report reviews and revisions.                                       
                                                                                  
  Separate report concepts into:                                                  
                                                                                  
  - Verification: unreviewed, verified, disputed.                                 
  - Disposition: actionable, duplicate, insufficient_information, false_report,   
    out_of_scope.                                                                 
                                                                                  
  - Escalation: barangay handling, municipal request, municipal acceptance.       
  - Incident state: new, active, monitoring, resolved, closed.                    
                                                                                  
  Maintain temporary compatibility mappings for existing report-status routes.    
                                                                                  
  ### Notifications and settings                                                  
                                                                                  
  Build on the existing notification/outbox schema with:                          
                                                                                  
  - Notification preferences.                                                     
  - Idempotency and delivery-attempt records.                                     
  - Provider receipts and terminal failure details.                               
  - Incident, assignment, center, directory-review, and security notification     
    types.                                                                        
                                                                                  
  - Typed inbox hooks and deep-link routing.                                      
                                                                                  
  ## Execution Phases                                                             
                                                                                  
  ### Phase 0 — Stabilization and Security                                        
                                                                                  
  1. Preserve unrelated and uncommitted user changes.                             
  2. Fix the existing TypeScript error and lint errors before adding features.    
  3. Add typecheck, lint, unit-test, and RLS-test commands.                       
  4. Make all official role helpers require an active profile.                    
  5. Ensure suspended officials fail RLS, RPC, storage, and Edge Function         
     authorization even with an existing session.                                 
                                                                                  
  6. Add an append-only general audit-event foundation.                           
  7. Import municipality-approved barangay polygons and validate locations        
     server-side through point-in-polygon checks.                                 
                                                                                  
  8. Use staging geometry only for development and block production rollout       
     until MDRRMO validates it.                                                   
                                                                                  
  9. Add RLS tests for resident, BDRRMO, cross-barangay BDRRMO, MDRRMO, Mayor,    
     suspended official, and admin.                                               
                                                                                  
  10. Use additive migrations and compatibility views; avoid destructive schema   
     replacement.                                                                 
                                                                                  
  Exit criteria: clean static checks, passing authorization matrix, verified      
  active-status enforcement, and migration rollback instructions.                 
                                                                                  
  ### Phase 1 — MDRRMO Navigation and Shared UI                                   
                                                                                  
  1. Implement the operations-first navigation.                                   
  2. Make Resources a dedicated tab and remove it from Community.                 
  3. Load official identity once through the portal context.                      
  4. Show notification and profile actions consistently in MDRRMO headers.        
  5. Create reusable UI only where used by multiple screens:                      
      - Section heading with count and +.                                         
      - Metric card.                                                              
      - Form bottom sheet.                                                        
      - Status chip.                                                              
      - Archive/confirmation dialog.                                              
                                                                                  
  6. Generalize the existing report map picker:                                   
      - Initialize from GPS, existing location, or the municipal center.          
      - Support map tapping and pin dragging.                                     
      - Display required attribution.                                             
      - Require a valid coordinate.                                               
      - Keep address/landmark optional.
      - Provide retry and map-unavailable states.                                 
                                                                                  
  7. Standardize loading, empty, error, saving, disabled, keyboard, and unsaved-  
     change states.                                                               
                                                                                  
  8. Apply Command’s visual system to all MDRRMO screens.                         
                                                                                  
  Exit criteria: Resources is discoverable, Settings remains reachable through    
  the avatar, and no resource creation form is permanently expanded.              
                                                                                  
  ### Phase 2 — Hotline and Facility Directory                                    
                                                                                  
  1. Add the directory fields and audit triggers.                                 
  2. Use scoped RPCs for save, edit, archive, reactivate, relink, and verify      
     operations.                                                                  
                                                                                  
  3. Redesign Hotlines:                                                           
      - Section heading, count, search/filter, and adjacent +.                    
      - Bottom-sheet creation and editing.                                        
      - Name, number, category, optional facility, authority, hours, alternate    
        contact, and active state.                                                
                                                                                  
      - Cards showing category, facility, verification freshness, and active      
        state.
                                                                                  
      - Call, edit, verify, archive, and reactivate actions.                      
                                                                                  
  4. Redesign Facilities:                                                         
      - Section heading, filters, count, and adjacent +.                          
      - Name, type, map location, optional address/contact, status, authority,    
        hours, services, and accessibility.                                       
                                                                                  
      - No normal latitude/longitude text fields.
      - Cards showing operating state, services, linked hotlines, address, and    
        verification age.                                                         
                                                                                  
  5. Add search/filtering by type, barangay, active state, operating state,       
     facility relationship, and overdue verification.                             
                                                                                  
  6. Show linked hotlines in facility details and facility map sheets.            
  7. Ensure BDRRMO sees municipality-wide active entries plus its local entries   
     but edits only local records.                                                
                                                                                  
  8. Keep Mayor and residents read-only for directory content.                    
  9. Protect the national emergency hotline from accidental reassignment or       
     archive.                                                                     
                                                                                  
  Exit criteria: MDRRMO can manage a linked directory through compact cards and   
  pop-ups without entering coordinates manually.
                                                                                  
  ### Phase 3 — Evacuation-Center Operations                                      
                                                                                  
  1. Add center metadata and append-only update records.                          
  2. Migrate legacy statuses:                                                     
      - open remains open.                                                        
      - full becomes open with full availability where supported.                 
      - closed_temporarily becomes closed.                                        
                                                                                  
  3. Add center creation through a + sheet.                                       
  4. Collect name, map location, optional facility, barangay, capacity, manager,  
     public directions, and initial standby state.                                
                                                                                  
  5. Separate metadata editing from the quick “Post center update” workflow.      
  6. Record occupancy, families, aggregate vulnerable groups, capabilities,       
     notes, actor, and timestamp in each update.                                  
                                                                                  
  7. Require a reason when MDRRMO or Mayor marks a center as priority.            
  8. Provide a status-history timeline instead of overwriting updates.            
  9. Apply permissions:                                                           
      - MDRRMO manages metadata and updates any center.                           
      - BDRRMO posts updates only for centers in its barangay.                    
      - Mayor reads summaries and changes only priority plus reason.              
      - Residents receive public-safe status, capacity, occupancy, directions,    
        and freshness.                                                            
                                                                                  
  Exit criteria: center status is accountable, timestamped, privacy-safe, and     
  actionable across roles.                                                        
                                                                                  
  ### Phase 4 — Command Dashboard Improvements                                    
                                                                                  
  1. Keep the current escalation carousel and modern report-status cards.         
  2. Replace Open · Priority · Total with:                                        
      - Open centers.                                                             
      - Current occupants versus known capacity.                                  
      - Near-capacity/full centers.                                               
      - Priority centers.                                                         
      - Stale open-center updates.                                                
                                                                                  
  3. Add evacuation attention cards for:                                          
      - Near/full centers.                                                        
      - Missing or stale updates.
      - Priority centers.                                                         
      - Limited water, sanitation, power, communications, accessibility, or       
        medical support.                                                          
                                                                                  
  4. Add View center and permission-aware Post update actions.                    
  5. Add compact operational quick actions:                                       
      - Log field observation.                                                    
      - Create incident.                                                          
      - Update center.                                                            
      - Publish advisory.                                                         
                                                                                  
  6. Display data timestamps and partial-data indicators so incomplete capacity   
     information is not presented as zero.                                        
                                                                                  
  7. Later in the incident phase, add:                                            
      - Unacknowledged municipal escalations.                                     
      - Active critical incidents.                                                
      - Overdue assignments/actions.                                              
      - Median acknowledgement and triage time.                                   
                                                                                  
  Exit criteria: the Command screen immediately identifies what requires MDRRMO   
  attention rather than displaying counts without context.                        
                                                                                  
  ### Phase 5 — Real Incident Workflow                                            
                                                                                  
  1. Create the incident, report-link, assignment, action, review, and revision   
     schema.                                                                      
                                                                                  
  2. Divide the Incidents screen into Incoming Reports and Active Incidents.      
  3. Sort incoming work by acknowledgement state, severity, age, and escalation.  
  4. Allow MDRRMO to:                                                             
      - Acknowledge.
      - Verify or dispute.                                                        
      - Classify disposition.                                                     
      - Accept or reject an escalation with a reason.                             
      - Create or link an incident.                                               
      - Assign a lead and actions.                                                
      - Resolve, reopen, and close with accountable notes.                        
                                                                                  
  5. Preserve resident submissions as immutable observations.                     
  6. Treat official origin as provenance, not automatic factual confirmation.     
  7. Replace official coordinate corrections with the reusable map picker and     
     revision history.                                                            
                                                                                  
  8. Keep reporter contact access purpose-bound and audited.                      
  9. Add call-attempt outcome without storing unnecessary conversation content.   
  10. Keep existing status URLs operational during migration.                     
                                                                                  
  Exit criteria: multiple reports can support one incident without destroying     
  their original evidence or status history.                                      
                                                                                  
  ### Phase 6 — Community and Notifications                                       
                                                                                  
  1. Keep Community focused on announcements and resident interaction.            
  2. Add advisory lifecycle states: draft, published, superseded, and cancelled.  
  3. Add effective time, expiry, geographic audience, and immutable publication   
     history.                                                                     
                                                                                  
  4. Do not represent ordinary announcements as authoritative emergency
     warnings.                                                                    
                                                                                  
  5. Implement the notification worker with retries, idempotency, delivery        
     receipts, and expired-token cleanup.                                         
                                                                                  
  6. Register and rotate Expo push tokens.                                        
  7. Replace the placeholder notification modal with:                             
      - Inbox list.                                                               
      - Unread badge.                                                             
      - Mark-read and mark-all-read.                                              
      - Loading/error/empty states.                                               
      - Deep links to related records.                                            
                                                                                  
  8. Notify appropriate roles about escalation, assignment, center priority,      
     center staleness, capability limitations, and directory review dates.        
                                                                                  
  9. Allow non-critical preference controls while keeping security and directly   
     assigned urgent operational events mandatory.                                
                                                                                  
  Exit criteria: notifications are stored, attributable, routable, and            
  operationally observable.                                                       
                                                                                  
  ### Phase 7 — MDRRMO Settings                                                   
                                                                                  
  1. Keep municipality-wide configuration outside personal Settings.              
  2. Account:                                                                     
      - View verified identity and contacts.                                      
      - Audited name updates.                                                     
      - Read-only government email, role, and scope.                              
      - Phone changes require OTP.                                                
      - Email/role/scope changes require administrator review and renewed         
        verification.
                                                                                  
  3. Security:                                                                    
      - Password change after reauthentication.                                   
      - TOTP MFA enrollment and removal.                                          
      - Recovery guidance.                                                        
      - Current-session and all-session logout.                                   
      - Recent security events.                                                   
                                                                                  
  4. Notifications:                                                               
      - Category and channel preferences.                                         
      - Push registration status.                                                 
      - Explanations for mandatory operational notifications.                     
                                                                                  
  5. Accessibility and language:                                                  
      - English, Filipino, and Cebuano catalogs for MDRRMO screens.               
      - English fallback.                                                         
      - High contrast and reduced motion.                                         
      - Device font scaling and complete screen-reader labels.                    
                                                                                  
  6. Help and privacy:
      - Emergency disclaimer.                                                     
      - Privacy notice and data-request contact.                                  
      - MDRRMO/system support details.                                            
      - App version and environment.                                              
                                                                                  
  7. Place logout in a separated destructive section with confirmation.           
                                                                                  
  Exit criteria: every control is functional and persisted; there are no          
  decorative or coming-soon settings.                                             
                                                                                  
  ### Phase 8 — Exports, Cross-Role Integration, and Pilot                        
                                                                                  
  1. Generate report, incident, and municipal summary PDFs server-side from       
     immutable snapshots.
                                                                                  
  2. Include references, source observations, location, media manifest,           
     verification history, actions, actors, cutoff time, generator, pages, and    
     verification hash.                                                           
                                                                                  
  3. Audit every export.                                                          
  4. Verify these end-to-end scenarios:                                           
      - Resident report → BDRRMO review → MDRRMO acceptance → incident →          
        resident update.                                                          
                                                                                  
      - Facility with linked hotlines → resident Home/map.                        
      - MDRRMO center creation → BDRRMO update → Mayor priority → resident view.  
      - Suspended official denied during an existing session.                     
                                                                                  
  5. Test small phones, low-end Android, large text, screen readers, denied       
     location, map failure, intermittent connectivity, and expired sessions.      
                                                                                  
  6. Conduct MDRRMO validation of barangays, facilities, hotlines, centers,       
     permissions, capacities, and thresholds.                                     
                                                                                  
  7. Pilot alongside the manual process and document rollback.                    
                                                                                  
  Exit criteria: passing automated checks, validated municipal data, signed       
  permission matrix, successful operational exercise, and tested rollback.        
                                                                                  
  ## Required Testing                                                             

  - Unit tests for validation, map bounds, hotline normalization, occupancy,      
    staleness, and compatibility mappings.                                        
                                                                                  
  - Component tests for editor sheets, map picker, center updates, Command        
    metrics, inbox, and Settings.                                                 
                                                                                  
  - RLS tests for every role and suspended/cross-scope access.                    
  - Integration tests for RPCs, audits, center snapshots, incident linking,       
    notification fan-out, account security, and exports.                          
                                                                                  
  - End-to-end tests for the four cross-role scenarios.                           
  - Accessibility tests for labels, focus order, touch targets, contrast, text    
    scaling, keyboard behavior, and non-color status indicators.                  
                                                                                  
  - Final verification: TypeScript, ESLint, unit/component tests, Supabase        
    tests, and Android/iOS smoke builds.                                          
                                                                                  
  ## Assumptions                                                                  
                                                                                  
  - docs/SOL.md is the document the user referred to as docs/SQL.md.              
  - Location points are required for facilities and centers; descriptive
    addresses are optional.                                                       
                                                                                  
  - Hotlines may exist independently or link to a facility.                       
  - Evacuee data remains aggregate-only.                                          
  - Near capacity defaults to 80%, and open-center updates become stale after     
    two hours; MDRRMO must approve these defaults before pilot.                   
                                                                                  
  - All new Supabase tables have RLS before client access.                        
  - Existing unrelated behavior and user changes are preserved.                   
  - Full CAP warning integration, named evacuee registration, resource-           
    deployment logistics, duty-shift handover, SitReps, and mature records        
    disposition remain later EOC-roadmap work.