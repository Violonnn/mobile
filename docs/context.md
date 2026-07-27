Rough summary sa changes
changes sa pag report:
1. g step process nako ang report, psychologically one step at a time provide low cognitive load, visually appealing ug maka urge sa users to continue. Which is crucial since g cater man natong as resilience atoang system ug as much as possible less friction when reporting ug less overwhelming sa situations nga chaotic
2. Steps:
1st step - getting location 
2nd step - attachments (vid/photos) 
3rd step - report details 
3. G una Nakong attached sa file (required live) since mao naman jud nang way sa karong panahona nga mag record/photo daan before i post so ma mimic ra kaysa sa mag details daan. Gamit kung ga baha then maka record or capture ra dayon kaysa sa mga suwat mag details. 

ako ra i push sa sub branch tom ang changes

ug expect lang mahuman tanan features within 3-7 days, ga hinay2 ko feature by feature kay mapareha pag last daghag guba ug na overlook. majority in handling sa data or system design since atong app dapat pas2 ug assume na ang codebase is deployment ready sa katong g ingon ni sir. 

// above kay 7/18/2026 //

// below mao na ako g focusan last sabado ug diri ko ga base sa tanan flow sa app //
// i check ug validate ang flow/feature if naay additions or modifications ug i compare sa current docs // 

Sa pag himo nakog database diri ko ga base.
Flow/feature:
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


Changes in regards sa authentication login

Note: mao ni imong gpangita nga changes 
The app prevents account numerations pasabot ani kay dili i specific igka validate if naa bana nga acc for security purposes e.g. ang user mo enter sa phone number in forgot password ang buhaton sa system is to generalized (“OTP has been sent”) regardless if ang number existed or not  rather than say (“Phone number not found!”). Exception sa registration kay needed na but with rate limiting
Rate Limiting - basically para maka prevent ug spam sa system. Especially sa outside services para di ta ma bankrupt. E.g. currently ang rate limiting sato system kay wrong pin login (5 times with 15 min lockout), sending of OTP SMS sa registration ug forgotpassword (3 total sends, +60 seconds cooldown. If nagamit ang 3 tanan then 1 hr para mabalik) 
Persisted Session para nako since nag cater mantag disaster response/reporting, if ang user ma logout taga close sa app then dira maka cause ug friction/delay. So ang buhaton ra ana kay ang user to keep it login.
Forgot Password
Miigration from uniSMS to iprogSMS since ang unisms caters higher services cost ceiling which is 3k sa nahinomdoman nako tungod sa policy changes compared sa iprogSMS where it is capstone friendly ug tag 200 ra pinaka lowest but limited to services (GLOBE/TM, DITO) which is mao ang usa sa limitation nato.


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
