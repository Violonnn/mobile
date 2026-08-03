You are the planning agent for this repository. Your role
  is to create an implementation-ready handoff for a       
  separate execution agent.                                
                                                           
  This contains the requested       
  feature, product intent, and any constraints.            
                                                           
  Then inspect the repository without modifying source     
  files:                                                   
  - Read all applicable `AGENTS.md` instructions.          
  - Identify existing components, hooks, utilities,        
  database patterns, routes, types, and styles that should 
  be reused.                                               
  - Find the closest existing implementation to use as a   
  reference.                                               
  - Inspect relevant Supabase schema, migrations, RLS      
  policies, and environment configuration when backend     
  changes are involved.                                    
  - Check package scripts and existing test/lint           
  conventions.                                             
                                                           
  Create or replace `execution.md` with a decision-complete
  implementation plan. Do not write application code.      
                                                           
  The execution plan must include:                         
                                                           
  1. Goal and acceptance criteria                          
     - Describe the user-visible outcome.                  
     - Define what must work for the feature to be         
     considered complete.                                  
                                                           
  2. Current-state findings                                
     - Name the existing files, components, hooks, routes, 
     tables, or utilities that the implementation should   
     reuse or extend.                                      
     - State important existing behavior that must not     
     regress.                                              
                                                           
  3. Implementation specification                          
     - Give ordered, concrete steps that an execution agent
     can follow without making product or architectural    
     decisions.                                            
     - For each meaningful change, identify the target file
     or folder and the intended responsibility.            
     - Specify navigation changes, UI behavior, loading    
     states, validation, errors, empty states, and success 
     feedback.                                             
     - Define any TypeScript types, function interfaces,   
     database columns, queries, migrations, storage        
     changes, or API contracts.                            
     - For Supabase changes, specify RLS requirements and  
     policies needed before client use.                    
     - Preserve existing architecture and reuse current    
     patterns; do not introduce abstractions unless real   
     duplication exists.                                   
                                                           
  4. Edge cases and security                               
     - Cover authorization, invalid input, missing data,   
     offline/network failures, duplicate submissions, and  
     permission failures where relevant.
     - Never expose secrets or use the Supabase service-   
     role key in the mobile client.                        
                                                           
  5. Verification plan                                     
     - List focused manual scenarios and automated checks. 
     - Include exact commands to run when discoverable from
     `package.json`.                                       
     - Include regression checks for affected existing     
     flows.                                                
                                                           
  6. Assumptions and unresolved decisions                  
     - Record only assumptions that were necessary.        
     - If a decision cannot be derived from `context.md` or
     repository evidence and would materially affect       
     implementation, stop and ask concise clarification    
     questions instead of guessing.                        
                                                           
  Write `execution.md` as an execution specification, not a
  discussion. Be specific enough that the execution agent  
  can implement directly, but keep it scoped to the        
  requested feature.                                       
                                                           
  A useful context.md structure is:                        
                                                           
  # Feature request                                        
  I want to develop the BDRMMO/MAYOR/MDRMMO flow so that I will develop my MVP towards residents and the officials. 

  In regards the feature see the scope of the project document # Scope , the rough planning # roughsummary and decide what is best feature to implement it. Include proper navigation and for now focused in the core feature. 

 # Scope
 Scope of the Project. The proposed project focuses on the following;
User Access and Security
o Secure Login and Registration for Residents.
o Role-Based Access Control for MDRRMO, BDRRMO and Mayor.
o Invite Link Generator and Revocation for Mayor and BDRRMO accounts.
o Email Verification and Forgot Password.
Map and Location Integration
o Base Map Setup.
o Live Capture of GPS and Reverse Geocoding.
o Map Search and Overlay Legend.
Disaster Reporting and Management
o GPS and Photo Upload requirements for residents.

o Two-tier Verification: Confirmation call from BDRRMO and MDRRMO re-
verification.

o Upvoting, commenting, and misinformation flagging of user reports.
o Contribution Reports Management
Community Communication Feed
o Integrated Feed UI for announcements and user reports.
o Pinned Posts for high-priority LGU/Mayor announcements.
o Notification of resources, disaster early warnings, and report contribution
statuses.
o Evacuation Center status toggles (Available/Full).

xix

Analytics and Administrative Tools
o System Admin Panel: Municipality and User Management.
o Mayor’s Dashboard: Visual analytics for resolved/unresolved incidents and
overall status logs of the municipality.
o Incident Documentation: One-click PDF Export for official reports.

# roughsummary
1. Notification built in: local and push notification (outside the app)
2. When user use report button, the system will ask for permission to use their location and camera, system use that location (convert to readable), then they can fill up following required details about short caption title, their description or their situation of their report, photos (3 max, at least 1 required) and videos (captures all user's sent video's duration, max is 30 seconds overall and at least 1 video). Photo and Video is only allowed live capture not in the gallery. 
3. The report is posted as unverified first, BDRMMO can verify it via a call or just straight mark it as verified, it should display the one who verified it and BDRMMO can escalate it to MDRMMO re verifies if it barangay cant handle it
4. BDRMMO MAYOR MDRMMO official can post their own announcement; BDRMMO for barangay level announcement, MDRMMO and MAYOR for municipail level announcement. BDRMMO and MDRMMO shares the same screen but validated or limited by role whereas the mayor is different different screen.
5. BDRMMO MAYOR MDRMMO official creates their account through an invite link. For example: 
Mayor invite:
https://disasterlink.app/invite?token=mayor_abc123
→ role locked to "mayor"

MDRRMO invite:
https://disasterlink.app/invite?token=mdrrmo_abc123
→ role locked to "officer", barangay_id = null

BDRRMO Barangay 1 invite:
https://disasterlink.app/invite?token=bdrrmo_brgy1_abc123
→ role locked to "officer", barangay_id = "1"
Hence 1 table for officials. 
6. Required details for the 3 officials are: id full name (separated by first,last,middle(optional)), email, password and confirm pass, role lock (mayor/officer), barangay_id (nullable), contact number or phone number, status (active/suspended) etc. they are also required to have them verify in their email account before ffinally registering. 
7. Invite links are expireable within 7 days. INvite links cannot be used once a user creates an account through that invite link with revocation.
8. Reports are reflected in the map live, so when user reports it will be shown in the map. 
9. In home screen, partial announcement, recebt today, happening near you is shown (with show all that redirect to the feed screen/page). 
10. Hotlines and facilities also shown in home screen, when user clieck view in map, it should redirect to the map screen with a mark on it.
11. Map only shows reports, hotlines, facilities, other important government stuffs related to disaster risk and response management like RHU, hospital, fire figeters 
12. Resident Report:
- Location (auto GPS)
- Title + description
- Photo/video required
- Status: "unverified" → BDRRMO calls to verify

Official Report:
- Location (auto GPS)
- Title + description
- Photo/video (optional, they're already trusted)
- Status: "verified" (auto-trusted, they verified it)
- Can edit later if details change
13. In feed, it must display based the reports in a social media algorithm way; users can upvote (1 upvote per user) which reflect to the report post, then they can also comment/reply in the said post. At the same time they can also flag the post or comment misinformation, spam, inappropriate. The officials can hide/remove the comment itself from the residents. They can also share the report link. 
14. officials can have evacuation center disaply in the map: 
Who decides:

MDRRMO creates/manages evacuation centers (municipality-wide planning)
BDRRMO can update status (center full, opened new one, closed temporarily)
Mayor can override/announce priority centers
15. Pinned post must be by mayor -> mdrmmo -> bdrmmo heirarachy 
16. Admin table role 
17. Mayor can see major analytics and also m/bdrmmo
18. Mayor:
- Export any report (municipality-wide PDF)
- Export analytics dashboard (resolved/unresolved incidents)

MDRRMO:
- Export any report (municipality-wide)
- Export analytics (municipality-wide)

BDRRMO:
- Export reports from their barangay only
- Export barangay-level analytics
PDF should include:
- Report details (title, description, location, GPS)
- Photos/videos (embed or link)
- Verification status (who verified, when)
- Comments/updates from BDRRMO
- Timeline (when reported, when verified, when escalated)


  # Why it matters                                         
  - put your description here so i can review it             
                                                           
  # User flow                                              
  - put your description here so i can review it                                               
                                                           
  # Required behavior                                      
  - put your description here so i can review it                                                  
                                                           
  # UI/content requirements                                
  - Screens affected:                                      
  - Text/copy:                                             
  - Design references:                                     
  - Accessibility requirements:           
  - put your description here so i can review it                 
                                                           
  # Data and permissions                                   
  - Who can view/create/edit/delete:                       
  - Data to collect or display:                            
  - Existing tables/services involved, if known:       
  - put your description here so i can review it    
                                                           
  # Constraints                                            
  - Must preserve:                                         
  - Out of scope:                                          
  - Deadline/platform limitations: 
  - put your description here so i can review it                      
                                                           
  # Acceptance examples                                    
  - Given ..., when ..., then ...   
  - put your description here so i can review it                     
                                                           
  The key is to make execution.md a contract: the execution
  agent should only need to inspect details necessary to   
  implement—not decide what the feature is supposed to do. 