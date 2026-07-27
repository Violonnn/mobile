# Revised admin portal plan — reference-  
  led, DisasterLink-native                  

  ## Visual direction                       
                                            
  Adopt the reference’s content-first       
  dashboard style while retaining           
  DisasterLink’s identity:                  
                                            
  - Light colors.background canvas, white   
    rounded cards, soft low-opacity navy    
    shadows, and generous 16–24px spacing.  
                                            
  - Sora typography, existing blue          
    colors.primary / colors.themeSoft       
    accents, and existing success/danger    
    colors for real statuses.               
                                            
  - Clean identity header, grouped          
    activity card, compact metric tiles,    
    recent-item list, and a fixed bottom    
    navigation—matching the reference’s     
    hierarchy.                              
                                            
  - Do not copy its black active state,     
    generic AI labels, search button, menu  
    button, fake metrics, or decorative     
    controls. Blue active states and only   
    real actions keep the UI consistent     
    and trustworthy.                        
                                            
  The admin portal will use a dedicated     
  bottom bar styled after the resident      
  BottomNav, but without the resident-only  
  Report action. It will have three equal   
  destinations: Overview, Invites, and      
  Accounts.                                 
                                            
  ## Navigation and routes                  
                                            
  - Replace app/admin.tsx with:             
      - app/admin/index.tsx — Overview,     
        available at /admin                 
                                            
      - app/admin/invitations.tsx —         
        current working invite management   
                                            
      - app/admin/accounts.tsx — UI-only    
        future account-management           
        placeholder                         
                                            
      - app/admin/_layout.tsx — protected   
        Expo Router Tabs shell
                                            
  - The layout will enforce                 
    requireActiveAdmin once for all child   
    routes and preserve current redirects   
    through resolveSessionDestination.      
                                            
  - Add a dedicated AdminBottomNav          
    component:                              
      - Overview: grid/dashboard icon       
      - Invites: link or mail icon          
      - Accounts: people icon               
      - White fixed bar, rounded top        
        corners, soft shadow, safe-area     
        padding, Sora labels, and a soft-   
        blue circular active icon           
        treatment matching the resident     
        navigation.                         

  - Do not reuse AppHeader or the resident  
    BottomNav directly because both         
    include resident-only behavior          
    (profile fetching, notification         
    placeholder, search, and emergency-     
    report action).                         
                                            
  ## Screen UI and behavior                 

  ### Overview                              
                                            
  - Create a compact admin identity         
    header: shield/DisasterLink mark,       
    “Admin workspace,” and the existing     
    logout action. No non-functional        
    search, hamburger, or notification      
    buttons.                                
                                            
  - Use a large rounded Invitation          
    activity card, modeled after the        
    reference:                              
      - Two real metric tiles only: Active  
        invites and Used invites.           
                                            
      - Each tile links to Invitations;     
        use a small arrow affordance only   
        because the action is real.         
                                            
      - Fetch through the existing          
        listOfficialInvites; show a         
        loading state, retryable error      
        state, and zero values when the     
        list is empty.                      
                                            
  - Add a Recent invitations card styled    
    like the reference’s creator list:      
      - Show the three most recent          
        existing invite records, sorted by  
        used_at ?? created_at.              
                                            
      - Each row shows role/scope, invited  
        email, date, and a truthful Active  
        or Used chip.                       
                                            
      - Provide one “View all” action to    
        Invitations; no inline revoke or    
        copy controls here.
                                            
  - Add a full-width blue “Create           
    invitation” action that opens           
    Invitations, where the existing form    
    remains the sole place to create        
    links.                                  
                                            
  - Do not show incident analytics,         
    municipality metrics, user totals, or   
    fake account data.                      
                                            
  ### Invitations                           
                                            
  - Move the current complete invite        
    functionality unchanged into this       
    route:                                  
      - Role and barangay selection
      - Government email and supported      
        mobile validation                   
                                            
      - Secure create RPC, manual-review    
        message, one-time deep-link         
        display and copy                    
                                            
      - Pull-to-refresh, active/used        
        lists, revoke confirmation,         
        loading and error states
                                            
  - Restyle rather than redesign:           
      - Use a clear “Create invitation”     
        section card with the existing      
        blue primary button.                
                                            
      - Make Active invitations and Used    
        invitations visually distinct       
        through real status chips and       
        light tonal tile backgrounds.       

      - Keep cards rounded and spacious;    
        use a subtle divider/list rhythm    
        similar to the reference’s lower    
        list.                               
                                            
      - Add copy explaining that the raw    
        link is visible only on this        
        screen immediately after creation.  
                                            
  - Keep history inside Invitations, not    
    as a fourth navigation destination.     
    Future status filters will be Active,   
    Used, Expired, and Revoked once a       
    secure RPC exposes the last two
    states.
                                            
  ### Accounts                              
                                            
  - Build an intentional UI-only
    placeholder screen; do not query,       
    display, edit, suspend, or expose       
    account data.                           
                                            
  - Use a large rounded empty-state card    
    with an account/shield icon and         
    concise copy:                           
      - “Account management is coming       
        soon.”                              
                                            
      - “This area will safely manage       
        official roles, barangay scope,     
        and active/suspended status.”       
                                            
  - Include three non-interactive
    capability rows—Official accounts,      
    Access status, Role & barangay scope—   
    using muted icons and “Coming soon”     
    labels.                                 
                                            
  - Do not add fake profiles, disabled      
    destructive controls, or placeholder    
    counts.                                 
                                            
  ## Styling implementation                 
                                            
  - Retain existing colors, fonts,          
    spacing, and radius tokens; add no new  
    global palette.                         
                                            
  - Use radius.xl for major grouped cards,  
    radius.lg for metrics/list rows, and    
    the existing white-card + blue-grey     
    background treatment.                   

  - Keep page content padded above the      
    bottom bar and use responsive flex/     
    grid layouts; metric tiles are two      
    columns with equal width and stack      
    only on exceptionally narrow screens.   
                                            
  - Add short comments only where layout    
    behavior is non-obvious, such as safe-  
    area bottom padding or the shared       
    admin access gate.                      

  - Keep touch targets at least 44px, give  
    every icon action a text accessibility  
    label, and maintain clear text          
    contrast.                               
                                            
  ## Security and data boundaries           
                                            
  - No new Supabase tables, migrations,     
    RLS policies, or RPCs in this pass.     
                                            
  - Continue using only                     
    create_official_invite,                 
    listOfficialInvites, and                
    revokeOfficialInvite.                   
                                            
  - Do not move raw invite tokens into      
    shared navigation state, dashboard      
    rows, logs, or history.                 
                                            
  - Analytics and exports remain future     
    mayor/MDRRMO/BDRRMO workspace           
    features; they do not belong in the     
    system-admin navigation.                
                                            
  ## Verification
                                            
  - Run npm run lint.                       
  - Verify an active admin can use /        
    admin, /admin/invitations, and /admin/  
    accounts, navigate via the fixed bar,   
    log out, and retain the existing        
    invitation workflow.                    
                                            
  - Verify Overview metrics and recent      
    rows exactly match the existing
    invitation data, including loading,     
    empty, refresh, and error states.       
                                            
  - Verify non-admin deep links to every    
    admin route redirect without rendering  
    protected content.                      
                                            
  - Verify the Accounts route performs no   
    Supabase fetch and communicates its     
    placeholder status clearly.             
                                            
  - Check narrow and short devices for      
    bottom-bar safe-area spacing, visible   
    primary actions, readable metric        
    tiles, and usable keyboard behavior on  
    invitation inputs.
                                            
  ## Assumptions                            
                                            
  - The current active admin role remains   

  - The supplied reference is a visual-     
    structure reference, not a source of    
    branding, colors, labels, or data       
    behavior.