# DisasterLink System Development and Iteration Plan

This plan combines the original 14 feature categories with dated revisions beneath their related tasks. Original task numbers are preserved. Each iteration heading continues the category numbering; its changes use a third level, such as 14.23.1. In Excel, place each numbered item on its own row and indent the third-level items.

The original tasks describe the development scope, not a list of remaining work. Dated iterations describe changes recorded in commits reachable from the current branch's HEAD, 0fbf497. Dates are Git author dates as reported by `git log --date=short`; they are evidence dates, not verified task start dates, delivery dates, sprint boundaries, or acceptance dates. A commit may support changes in more than one category. Iteration numbering is local to each category and does not claim that formal sprints occurred.

Only identifiable later revisions are called iterations. Initial implementation commits are not automatically relabeled as revisions. November working-tree changes are uncommitted and excluded from this historical iteration record. Testing tasks in the original scope do not establish that tests passed; dated entries record only the changes supported by their commits.

## 1. System Planning and Setup

1.1 Identify system users and their responsibilities.  
1.2 Gather requirements for each user role.  
1.3 Define system scope and limitations.  
1.4 Document the incident reporting and response workflow.  
1.5 Plan screen layouts and navigation flows.  
1.6 Define the frontend, backend, and database architecture.  
1.7 Set up the development environment.  
1.8 Configure the project repository and version control.  
1.9 Configure environment variables and service connections.  
1.10 Prepare development milestones and task assignments.  

**1.11 Iteration 1: Development Rules — July 26, 2026**

1.11.1 Add repository coding and collaboration instructions. Evidence: `154ae7a`.  

**1.12 Iteration 2: Reproducible Project Setup — September 22, 2026**

1.12.1 Enforce reproducible Expo project setup. Evidence: `c99941d`.  
1.12.2 Regenerate the dependency lockfile for clean installation. Evidence: `b21f3a2`.  

**1.13 Iteration 3: Project Startup Correction — October 28, 2026**

1.13.1 Correct Expo startup behavior that produces a shell argument warning. Evidence: `9584cd7`.  

## 2. Landing Page and User Access

2.1 Design the application entry and welcome experience.  
2.2 Design the resident login interface.  
2.3 Design the official login interface.  
2.4 Design the resident registration interface.  
2.5 Collect and validate resident information.  
2.6 Validate phone numbers and supported carriers.  
2.7 Implement registration OTP delivery.  
2.8 Implement OTP entry and verification.  
2.9 Handle OTP expiration, resend limits, and cooldowns.  
2.10 Implement resident PIN creation and confirmation.  
2.11 Implement resident phone number and PIN login.  
2.12 Implement official email and password login.  
2.13 Implement account recovery and credential reset.  
2.14 Restore valid user sessions when opening the application.  
2.15 Route users to their assigned portals.  
2.16 Restrict access for inactive or unauthorized accounts.  
2.17 Display login errors and submission feedback.  
2.18 Implement secure logout and session cleanup.  

**2.19 Iteration 1: Registration Interaction Corrections — June 14, 2026**

2.19.1 Correct PIN input display and styling. Evidence: `e39fa02`.  
2.19.2 Improve registration stepper animation and label placement. Evidence: `7bbd8d3`, `3a2cb4a`.  
2.19.3 Update supported phone prefixes. Evidence: `6b66760`.  
2.19.4 Simplify location fields and improve barangay selection. Evidence: `a57a0f1`.  
2.19.5 Add terms and privacy modal content. Evidence: `0679ab0`.  
2.19.6 Add registration loading indicators and refine error placement. Evidence: `7d0a252`.  

**2.20 Iteration 2: Login and OTP Refinement — June 15, 2026**

2.20.1 Refine the welcome animation and registration success message. Evidence: `cc1e1c2`.  
2.20.2 Correct simultaneous masked and visible PIN display. Evidence: `cc1e1c2`.  
2.20.3 Improve login layout, validation, and remembered phone number behavior. Evidence: `84693f8`.  
2.20.4 Remove the guest access flow. Evidence: `84693f8`.  
2.20.5 Add OTP send limits, cooldown tracking, and clearer error handling. Evidence: `52194e6`.  
2.20.6 Extend phone prefix support. Evidence: `10c1330`.  

**2.21 Iteration 3: Splash Correction — June 26, 2026**

2.21.1 Correct the static splash icon. Evidence: `ae2743e`.  

**2.22 Iteration 4: SMS Provider Change — July 12, 2026**

2.22.1 Replace the UniSMS integration with IPROG. Evidence: `0c0e172`.  
2.22.2 Correct frontend and backend registration validation. Evidence: `0c0e172`.  
2.22.3 Refine name and phone prefix validation. Evidence: `0c0e172`.  

**2.23 Iteration 5: Account Recovery and Session Safety — July 13, 2026**

2.23.1 Add backend OTP support for PIN reset. Evidence: `92efeb1`.  
2.23.2 Add the forgot-PIN flow using shared OTP verification. Evidence: `7342371`.  
2.23.3 Prevent account enumeration through authentication responses. Evidence: `0d03c24`.  
2.23.4 Restore persisted sessions at application startup. Evidence: `1b622f7`.  
2.23.5 Replace social login placeholders with a version label. Evidence: `96843ee`.  

**2.24 Iteration 6: Onboarding and Login Redesign — August 22, 2026**

2.24.1 Revise the onboarding interface. Evidence: `943b8f4`.  
2.24.2 Revise the login interface. Evidence: `943b8f4`.  

**2.25 Iteration 7: Onboarding Layout Correction — August 24, 2026**

2.25.1 Correct bottom safe-area spacing on onboarding screens. Evidence: `f444e9e`.  

**2.26 Iteration 8: Entry Experience Simplification — September 22, 2026**

2.26.1 Remove the separate welcome screen. Evidence: `adfd19c`.  
2.26.2 Refine splash animation. Evidence: `0c8c0ae`.  
2.26.3 Refresh application icons and splash assets. Evidence: `17c7e8a`.  

**2.27 Iteration 9: Login and Session Routing — September 23, 2026**

2.27.1 Redesign resident and official login screens. Evidence: `bfe7a0e`.  
2.27.2 Start the application through the session entry route. Evidence: `0c9a2c2`.  

**2.28 Iteration 10: Authentication Feedback and Transitions — September 24, 2026**

2.28.1 Improve authentication feedback. Evidence: `9e24d9b`.  
2.28.2 Cache official login carousel images. Evidence: `764b9dd`.  
2.28.3 Streamline the resident login splash handoff. Evidence: `f416759`.  
2.28.4 Bypass the launch splash after logout. Evidence: `620f140`.  
2.28.5 Refine resident authentication demo flows. Evidence: `1fbdf3d`.  

**2.29 Iteration 11: Portal Switching — September 27, 2026**

2.29.1 Streamline switching between resident and official access. Evidence: `41d9549`.  

## 3. Resident Home and Navigation

3.1 Design the resident home screen layout.  
3.2 Display resident profile and barangay information.  
3.3 Display the welcome message for newly registered residents.  
3.4 Display official announcement previews.  
3.5 Display nearby public incidents.  
3.6 Display preparedness reminders.  
3.7 Provide quick access to incident reporting.  
3.8 Provide quick access to emergency resources.  
3.9 Implement bottom navigation tabs.  
3.10 Connect home screen shortcuts to their destination screens.  
3.11 Implement refresh behavior for home screen information.  
3.12 Handle unavailable location, loading, and empty results.  

**3.13 Iteration 1: Home Theme and Navigation — July 21, 2026**

3.13.1 Redesign the shared application header. Evidence: `ab085c0`.  
3.13.2 Redesign the bottom navigation and home screen theme. Evidence: `ab085c0`.  

**3.14 Iteration 2: Report Discovery — August 10, 2026**

3.14.1 Improve resident home report discovery. Evidence: `4189f07`.  
3.14.2 Replace the report action icon with a marker icon. Evidence: `8ef6ba1`.  

**3.15 Iteration 3: Resident Interface Revision — August 22, 2026**

3.15.1 Revise the resident interface and screen presentation. Evidence: `f8414b4`.  

**3.16 Iteration 4: Home Screen Refresh — August 29, 2026**

3.16.1 Refresh the resident home screen. Evidence: `0b8da92`.  
3.16.2 Revise the official updates interface. Evidence: `3909df0`.  

**3.17 Iteration 5: Home and Map Experience — September 4, 2026**

3.17.1 Enhance the resident home and its map experience. Evidence: `38e0219`.  

**3.18 Iteration 6: Resident Screen Refinement — September 17, 2026**

3.18.1 Refine the resident home presentation. Evidence: `ff0f241`.  
3.18.2 Refine interactions between the home, feed, and map. Evidence: `ff0f241`.  

**3.19 Iteration 7: Dashboard Refinement — September 22, 2026**

3.19.1 Polish the resident dashboard and reporting experience. Evidence: `60abafa`.  

**3.20 Iteration 8: Navigation and Shortcut Corrections — September 23, 2026**

3.20.1 Guard back navigation when no previous route exists. Evidence: `984d8e3`.  

**3.21 Iteration 9: Resource Shortcut Consistency — September 24, 2026**

3.21.1 Align resident resource shortcut icons. Evidence: `098b453`.  

**3.22 Iteration 10: Large-Text Accessibility — September 26, 2026**

3.22.1 Adapt resident layouts to enlarged system text. Evidence: `abe0862`.  
3.22.2 Refine affected navigation, home, login, and report layouts. Evidence: `abe0862`.  

## 4. Incident Reporting

4.1 Design the reporting steps and progress indicator.  
4.2 Display incident categories and descriptions.  
4.3 Collect the incident title and description.  
4.4 Validate required fields and text limits.  
4.5 Request device location permission.  
4.6 Capture the resident's current GPS location.  
4.7 Allow incident location selection on the map.  
4.8 Collect barangay and landmark information.  
4.9 Check whether the incident location is within coverage.  
4.10 Capture or select supporting photos.  
4.11 Capture or select supporting video.  
4.12 Validate attachment types, sizes, and requirements.  
4.13 Display attachment previews and removal controls.  
4.14 Collect public sharing preferences.  
4.15 Display the report summary before submission.  
4.16 Submit report information and supporting media.  
4.17 Save pending reports when delivery is unavailable.  
4.18 Retry pending submissions when connectivity returns.  
4.19 Display submission confirmation or delivery delays.  
4.20 Display report review and response progress.  
4.21 Display report history and official outcomes.  

**4.22 Iteration 1: Media Loading and Reporting Flow — September 17, 2026**

4.22.1 Improve private report media loading speed. Evidence: `1034cdd`.  
4.22.2 Refine incident reporting steps. Evidence: `9e6a1c4`.  
4.22.3 Improve incident location handling. Evidence: `9e6a1c4`.  
4.22.4 Update resident evidence requirements. Evidence: `9e6a1c4`.  
4.22.5 Add report location test coverage. Evidence: `9e6a1c4`.  

**4.23 Iteration 2: Reporting Interface Refinement — September 22, 2026**

4.23.1 Polish the resident reporting experience. Evidence: `60abafa`.  

**4.24 Iteration 3: Detail Loading and Status Labels — October 25, 2026**

4.24.1 Accelerate official report detail loading. Evidence: `7d7a223`.  
4.24.2 Refine report status and elapsed-time labels. Evidence: `8cb1910`.  

## 5. Interactive Map

5.1 Design the map screen layout and controls.  
5.2 Load the map and initial viewing area.  
5.3 Request and display the user's current location.  
5.4 Display incident markers visible to the current user.  
5.5 Display facility markers.  
5.6 Display evacuation center markers.  
5.7 Apply marker colors and incident indicators.  
5.8 Display the map legend.  
5.9 Implement incident and resource visibility controls.  
5.10 Implement available barangay and status filters.  
5.11 Display a preview when selecting a marker.  
5.12 Open detailed incident or resource information.  
5.13 Display the resident's own report contributions.  
5.14 Focus the map on selected incidents and resources.  
5.15 Refresh map information after relevant updates.  
5.16 Handle denied permissions and map loading failures.  

**5.17 Iteration 1: Resident Map Enhancement — September 4, 2026**

5.17.1 Enhance the resident map experience. Evidence: `38e0219`.  

**5.18 Iteration 2: Resident Map Refinement — September 17, 2026**

5.18.1 Refine resident map presentation and related screen interactions. Evidence: `ff0f241`.  

**5.19 Iteration 3: Resource Selection and Icon Corrections — September 24, 2026**

5.19.1 Focus selected resident resources without opening detail sheets. Evidence: `f54cae7`.  
5.19.2 Standardize official evacuation center icons. Evidence: `969db1a`.  

**5.20 Iteration 4: Android Map Stability — October 25, 2026**

5.20.1 Stabilize report maps in Android WebView. Evidence: `21d7e97`.  

**5.21 Iteration 5: SDK Upgrade Compatibility — October 26, 2026**

5.21.1 Preserve WebView map behavior on Expo SDK 58. Evidence: `7486f65`.  

## 6. Community Feed and Announcements

6.1 Design the community feed screen.  
6.2 Organize announcements and public incident content.  
6.3 Display official announcement cards.  
6.4 Display announcement details and attachments.  
6.5 Display approved public report and incident cards.  
6.6 Display public incident details and response updates.  
6.7 Implement barangay filters.  
6.8 Implement available incident status filters.  
6.9 Display comments and discussion threads.  
6.10 Implement comment submission and validation.  
6.11 Implement supported reactions and incident support actions.  
6.12 Display comment and reaction counts.  
6.13 Allow authorized officials to create announcements.  
6.14 Allow authorized officials to update or remove announcements.  
6.15 Implement feed refresh and additional content loading.  
6.16 Display loading, empty, and error states.  

**6.17 Iteration 1: Announcement Card Refresh — August 10, 2026**

6.17.1 Refresh announcement feed cards. Evidence: `c860dc9`.  

**6.18 Iteration 2: Official Update Presentation — August 29, 2026**

6.18.1 Revise the official updates interface. Evidence: `3909df0`.  

**6.19 Iteration 3: Resident and Official Feed Refinement — September 17, 2026**

6.19.1 Polish resident feed presentation. Evidence: `ff0f241`.  
6.19.2 Improve official community update workflows. Evidence: `fbe0fd0`.  

**6.20 Iteration 4: Community Workflow Refinement — September 30, 2026**

6.20.1 Refine community and official workflows. Evidence: `aaa5674`.  
6.20.2 Update resident access to cross-barangay announcements. Evidence: `aaa5674`.  
6.20.3 Extend official announcement feed test coverage. Evidence: `aaa5674`.  

## 7. BDRRMO Operations

7.1 Design the barangay dashboard layout.  
7.2 Display barangay incident summaries and priority items.  
7.3 Display incoming reports within the assigned barangay.  
7.4 Implement report search and available filters.  
7.5 Display report details and private supporting evidence.  
7.6 Check incident location and barangay responsibility.  
7.7 Record report review decisions and verification findings.  
7.8 Link related reports to the appropriate incident.  
7.9 Log incidents reported directly to the barangay office.  
7.10 Record response actions and service involvement.  
7.11 Post incident progress updates.  
7.12 Request municipal assistance.  
7.13 Request transfer of incident responsibility.  
7.14 Track assistance and transfer request outcomes.  
7.15 Review information and photos for public publication.  
7.16 Record incident resolution and supporting details.  
7.17 Reopen incidents when permitted by the workflow.  
7.18 Review the incident activity timeline.  

**7.19 Iteration 1: Official Response Workspace Refinement — September 17, 2026**

7.19.1 Refine the shared official response workspaces. Evidence: `a8ffa49`.  

**7.20 Iteration 2: Official Interface Simplification — September 22, 2026**

7.20.1 Streamline official workspace interfaces. Evidence: `4e7ae2e`.  

**7.21 Iteration 3: Barangay-Specific Workspace Revision — September 27, 2026**

7.21.1 Document the BDRRMO workspace optimization plan. Evidence: `d7d2f25`.  
7.21.2 Revoke BDRRMO access after report escalation under the committed workflow. Evidence: `91398da`.  
7.21.3 Add the BDRRMO report review workspace. Evidence: `19ce231`.  
7.21.4 Optimize BDRRMO command navigation. Evidence: `f068d22`.  
7.21.5 Tailor the barangay local response map. Evidence: `b4036c8`.  
7.21.6 Polish barangay community, resources, and settings. Evidence: `6773d07`.  

## 8. MDRRMO Operations

8.1 Design the municipal dashboard layout.  
8.2 Display municipal incident summaries and priority items.  
8.3 Display incidents across barangays.  
8.4 Implement municipal incident search and filters.  
8.5 Display incidents and requests on the municipal map.  
8.6 Review incoming assistance requests.  
8.7 Accept or return assistance requests with an explanation.  
8.8 Review requests to transfer incident responsibility.  
8.9 Record municipal verification findings.  
8.10 Log incidents reported directly to the municipal office.  
8.11 Record municipal response actions and service involvement.  
8.12 Post response progress updates.  
8.13 Review public incident information and supporting photos.  
8.14 Record incident resolution and closure details.  
8.15 Review incident history and coordination records.  
8.16 Respond to incident update requests from the mayor.  

**8.17 Iteration 1: Municipal Workspace Redesign — August 23, 2026**

8.17.1 Rebuild the MDRRMO command workspace. Evidence: `63f9ed3`.  
8.17.2 Improve the municipal report queue. Evidence: `8ea90e1`.  
8.17.3 Focus the municipal map on escalated reports. Evidence: `b91dc0e`.  
8.17.4 Refresh the municipal community workspace. Evidence: `397b36e`.  
8.17.5 Update municipal settings and account security. Evidence: `f15e91d`.  

**8.18 Iteration 2: Municipal Response Refinement — September 17, 2026**

8.18.1 Streamline the official response workspaces. Evidence: `a8ffa49`.  

**8.19 Iteration 3: Workspace Interface Simplification — September 22, 2026**

8.19.1 Streamline official workspace interfaces. Evidence: `4e7ae2e`.  
8.19.2 Document the MDRRMO screen optimization plan. Evidence: `b621acc`.  

## 9. Mayor Monitoring

9.1 Design the mayor dashboard layout.  
9.2 Display municipality-wide incident summaries.  
9.3 Display incident totals by current status.  
9.4 Display barangay summaries and filters.  
9.5 Display incidents on the monitoring map.  
9.6 Display incidents requiring attention.  
9.7 Display municipal assistance and coordination summaries.  
9.8 Display recent response activities.  
9.9 Display evacuation center conditions.  
9.10 Open detailed incident monitoring views.  
9.11 Request incident updates from responsible officials.  
9.12 Display official responses to update requests.  

**9.13 Iteration 1: Mayor Interface Revision — August 23, 2026**

9.13.1 Update the mayor briefing screen. Evidence: `f84d8f8`.  
9.13.2 Update the mayor situations screen. Evidence: `44692e1`.  
9.13.3 Add the mayor municipal map view. Evidence: `8072c43`.  
9.13.4 Tailor mayor community and settings screens. Evidence: `10bbac7`.  
9.13.5 Highlight the active mayor navigation tab. Evidence: `bb5fe4f`.  

**9.14 Iteration 2: Situation Dashboard Refresh — September 17, 2026**

9.14.1 Refresh the mayor situation dashboard. Evidence: `8215346`.  

**9.15 Iteration 3: Response Oversight — October 8, 2026**

9.15.1 Add the mayor response watchlist. Evidence: `00cea6d`.  
9.15.2 Identify the longest-waiting barangay report. Evidence: `00cea6d`.  
9.15.3 Identify the longest-waiting municipal escalation. Evidence: `00cea6d`.  
9.15.4 Identify reports with missing operational context. Evidence: `00cea6d`.  
9.15.5 Identify reports with inactive status updates. Evidence: `00cea6d`.  
9.15.6 Refine status labels and reverification information. Evidence: `00cea6d`.  
9.15.7 Refine associated briefing, situations, and map displays. Evidence: `00cea6d`.  

## 10. Administration and Invitations

10.1 Design the administrator dashboard layout.  
10.2 Display invitation and registration summaries.  
10.3 Design the official invitation form.  
10.4 Select the invited official's role.  
10.5 Assign office or barangay coverage.  
10.6 Validate invitation details and eligibility.  
10.7 Generate invitation links with expiration dates.  
10.8 Provide invitation copying controls.  
10.9 Display and filter invitation records.  
10.10 Display pending, used, expired, and revoked invitations.  
10.11 Revoke invitations with confirmation.  
10.12 Validate invitation links during registration.  
10.13 Collect and verify invited official information.  
10.14 Complete official account registration.  
10.15 Handle invalid, expired, revoked, or previously used invitations.  
10.16 Restrict administrator tools to authorized accounts.  

Historical implementation evidence: July 27, 2026 — `4b840bb`, `a8fb162`, `ed4dfa7`, and `f41439e` introduced secure invitation management, official registration, invite-only access, and the administrator portal. A distinct later administrator-specific revision was not established from the reviewed commits. Current uncommitted administrator changes are not assigned a completed iteration or historical date here.

## 11. Emergency Resource Management

11.1 Design the emergency resource directory layout.  
11.2 Organize hotlines, facilities, and evacuation centers.  
11.3 Display hotline names and contact details.  
11.4 Provide emergency calling controls.  
11.5 Add and update hotline information.  
11.6 Display facility details and locations.  
11.7 Add and update facility information.  
11.8 Display evacuation center details and locations.  
11.9 Update evacuation center availability and occupancy information.  
11.10 Validate resource names, contacts, and locations.  
11.11 Restrict resource changes to authorized officials.  
11.12 Reflect resource changes in resident views and maps.  

**11.13 Iteration 1: Resource Management Simplification — September 17, 2026**

11.13.1 Simplify emergency resource management interfaces. Evidence: `b611aa9`.  

**11.14 Iteration 2: Resource Icon Consistency — September 24, 2026**

11.14.1 Align resident resource shortcut icons. Evidence: `098b453`.  
11.14.2 Standardize official evacuation center icons. Evidence: `969db1a`.  

**11.15 Iteration 3: Barangay Resource Interface Refinement — September 27, 2026**

11.15.1 Refine BDRRMO resource screens within the barangay workspace. Evidence: `6773d07`.  

## 12. Notifications and User Settings

12.1 Design the notification inbox layout.  
12.2 Display notification previews and timestamps.  
12.3 Display unread notification counts.  
12.4 Deliver report review and response notifications.  
12.5 Deliver relevant announcement and coordination notifications.  
12.6 Open notification details and related records.  
12.7 Mark individual notifications as read.  
12.8 Implement marking all notifications as read.  
12.9 Design the profile and account settings screens.  
12.10 Display and update permitted profile information.  
12.11 Upload, replace, or remove profile photos.  
12.12 Provide credential and account settings controls.  
12.13 Display privacy information and legal notices.  
12.14 Provide logout confirmation and feedback.  

**12.15 Iteration 1: Profile Screen Redesign — July 21, 2026**

12.15.1 Redesign the profile screen with an identity block. Evidence: `3b79154`.  
12.15.2 Organize profile actions into a menu list. Evidence: `3b79154`.  

**12.16 Iteration 2: Resident Settings Expansion — August 22, 2026**

12.16.1 Add resident settings functionality to the existing resident experience. Evidence: `b7d2d8d`.  

**12.17 Iteration 3: Official Settings Refinement — August 23, 2026**

12.17.1 Update MDRRMO settings and account security. Evidence: `f15e91d`.  
12.17.2 Tailor settings for the mayor. Evidence: `10bbac7`.  

**12.18 Iteration 4: Activity Inbox and Account Safety — September 17, 2026**

12.18.1 Add an activity notification inbox to the existing application. Evidence: `71cdb1f`.  
12.18.2 Improve resident profiles and account safety. Evidence: `023c2d6`.  

**12.19 Iteration 5: Barangay Settings Refinement — September 27, 2026**

12.19.1 Refine settings in the BDRRMO workspace. Evidence: `6773d07`.  

## 13. Database and Security

13.1 Define database tables and relationships.  
13.2 Create and maintain database migrations.  
13.3 Apply required constraints and indexes.  
13.4 Enable Row-Level Security on application tables.  
13.5 Define resident data access policies.  
13.6 Define barangay and municipal access policies.  
13.7 Define mayor and administrator access policies.  
13.8 Validate incoming data in trusted backend functions.  
13.9 Enforce authentication and request limits.  
13.10 Configure private storage for report evidence.  
13.11 Control access to uploaded photos and videos.  
13.12 Separate private evidence from approved public content.  
13.13 Enforce identity, location, and media sharing permissions.  
13.14 Record review decisions and operational activity.  
13.15 Protect credentials and service configuration.  
13.16 Review compatibility between application and database changes.  

**13.17 Iteration 1: Authentication Disclosure Protection — July 13, 2026**

13.17.1 Prevent account enumeration in authentication flows. Evidence: `0d03c24`.  

**13.18 Iteration 2: Database Function Hardening — July 14, 2026**

13.18.1 Harden Supabase function search paths. Evidence: `f48a348`.  
13.18.2 Restrict the automatic RLS-enabling function. Evidence: `f48a348`.  

**13.19 Iteration 3: Access Validation Coverage — September 17, 2026**

13.19.1 Expand automated active-profile access checks. Evidence: `937f528`.  

**13.20 Iteration 4: Escalation Access Correction — September 27, 2026**

13.20.1 Correct BDRRMO access after report escalation under the committed workflow. Evidence: `91398da`.  

**13.21 Iteration 5: Read Performance and Authorization Coverage — September 30, 2026**

13.21.1 Add resident report read indexes. Evidence: `aaa5674`.  
13.21.2 Update announcement visibility rules. Evidence: `aaa5674`.  
13.21.3 Extend active-profile authorization checks. Evidence: `aaa5674`.  

## 14. System Testing and Deployment

14.1 Prepare test scenarios for each user role.  
14.2 Test resident registration, login, and account recovery.  
14.3 Test official invitations and registration.  
14.4 Test role routing and unauthorized access restrictions.  
14.5 Test report submission and media uploads.  
14.6 Test offline report storage and submission retries.  
14.7 Test barangay review and response workflows.  
14.8 Test municipal assistance and transfer workflows.  
14.9 Test incident publication and privacy controls.  
14.10 Test maps, location permissions, and filters.  
14.11 Test announcements, comments, and reactions.  
14.12 Test emergency resources and notification behavior.  
14.13 Test mayor monitoring and administrator tools.  
14.14 Test small screens, large text, and keyboard behavior.  
14.15 Test slow connections, empty results, and service failures.  
14.16 Run automated code and database checks.  
14.17 Conduct user acceptance testing and record feedback.  
14.18 Fix identified issues and retest affected workflows.  
14.19 Prepare application builds and release configuration.  
14.20 Deploy approved application and backend updates.  
14.21 Verify essential workflows after deployment.  
14.22 Finalize user guides and technical documentation.  

**14.23 Iteration 1: Expo SDK 57 Compatibility — September 4, 2026**

14.23.1 Align project dependencies with Expo SDK 57. Evidence: `3e2edd6`.  
14.23.2 Update Expo SDK 57 configuration. Evidence: `26240c3`.  
14.23.3 Correct application code affected by SDK 57. Evidence: `3756cd5`.  

**14.24 Iteration 2: Automated Access and Location Checks — September 17, 2026**

14.24.1 Expand active-profile access checks. Evidence: `937f528`.  
14.24.2 Add report location test coverage. Evidence: `9e6a1c4`.  
14.24.3 Add report workflow guides. Evidence: `c8b9006`.  

**14.25 Iteration 3: Installation Compatibility Corrections — September 22, 2026**

14.25.1 Enforce reproducible Expo setup. Evidence: `c99941d`.  
14.25.2 Regenerate the dependency lockfile for clean installation. Evidence: `b21f3a2`.  
14.25.3 Align Lottie with Expo SDK 57. Evidence: `7835333`.  

**14.26 Iteration 4: Runtime and Dependency Corrections — October 25, 2026**

14.26.1 Restore missing emnapi peer entries in the lockfile. Evidence: `91f913f`.  
14.26.2 Correct Android WebView report map behavior. Evidence: `21d7e97`.  
14.26.3 Improve official report detail loading performance. Evidence: `7d7a223`.  

**14.27 Iteration 5: Expo SDK 58 Compatibility — October 26, 2026**

14.27.1 Upgrade Expo dependencies to SDK 58. Evidence: `adc1ce6`.  
14.27.2 Migrate navigation to Expo Router 58. Evidence: `6a44525`.  
14.27.3 Update React Native 0.88 component instance types. Evidence: `dcfad36`.  
14.27.4 Preserve WebView map behavior after the upgrade. Evidence: `7486f65`.  
14.27.5 Resolve React compiler lint violations. Evidence: `a8885be`.  

**14.28 Iteration 6: Startup and Patch Dependency Corrections — October 28, 2026**

14.28.1 Correct the Expo startup shell argument warning. Evidence: `9584cd7`.  
14.28.2 Align Expo SDK 58 patch dependencies. Evidence: `0fbf497`.  

## Excel Layout

Use these columns: WBS | Task Title | Record Type | Revision Date | Commit Evidence | Owner | Planned Start | Planned Finish | Actual Start | Actual Finish | Status | Review Outcome | Timeline.

- Use Record Type values of Original Task, Iteration Summary, and Iteration Change.
- Keep the general feature category as the top-level row.
- Keep the original task rows beneath it.
- Append each dated iteration summary beneath those original tasks.
- Indent iteration changes one additional level and allow their rows to collapse.
- Store WBS identifiers as text, so 2.19.1 and 14.28.2 remain intact.
- Keep Revision Date separate from planned and actual execution dates. Do not copy commit dates into start and finish fields without supporting records.
- A commit date marks recorded code activity; it does not establish completed testing, deployment, or stakeholder acceptance.
- Shared commits may appear under several affected features. Assign effort once when calculating project totals to avoid double counting the same work.

## Agile Review Fields

For each dated iteration, record the reason for the revision, acceptance criteria, verification evidence, review outcome, and any follow-up backlog items. Use actual feedback or test records when available. If a reason or acceptance decision is undocumented, leave it unrecorded rather than inventing a retrospective explanation. The dated groups above describe implementation history, not evidence that formal Agile ceremonies occurred.
