# DisasterLink install inventory

Prepared 30 October 2026 for report response flow Phase 1, version `1.0.1`,
Android version code `2`, iOS build number `2`.

| Channel / holder | Evidence | Installed version / identifier | Replacement path | Status |
| --- | --- | --- | --- | --- |
| Physical iPhone / project tester | Owner confirmed Expo Go in Q7 of the flow plan | Current project bundle; Expo Go is the host app | Restart Metro and reload the project | Known development client; never block with a store-update screen |
| Web / holders not inventoried | Repository supports Expo web export | Current deployed bundle not established | Reload the current site | Exempt from native gate; device acceptance pending |
| Android standalone / none shared | Owner confirmed 30 October 2026: Expo Go / development only; no standalone builds shared | Configured package remains `com.yourcompany.disasterlink` | No standalone replacement needed today | No distributed install reported |
| iOS standalone / none shared | Owner confirmed 30 October 2026: Expo Go / development only; no standalone builds shared | Configured bundle remains `com.yourcompany.disasterlink` | No standalone replacement needed today | No distributed install reported |

Owner confirmation received 30 October 2026: **Expo Go / development only; no
standalone builds shared.** No APK, IPA, TestFlight, Play test-track, or sideloaded
distribution is reported. Recheck this inventory before any enforcement; record
future holders, channel, package identifier, installed version, last use, and
same-package replacement test. Do not enable enforcement for the current setup.

Municipality-owned identifiers have not been supplied. Keep the existing IDs for
development; obtain approved identifiers before wider standalone distribution.
Do not invent ownership or change an ID on an already distributed app without
recording the resulting replacement limitation.

Policy defaults are `minimum_supported_version = 1.0.0`, `latest_version = 1.0.1`,
`download_url = null`, `enforce = false` on both platforms. No native distribution
or update availability is claimed by these version numbers.

`app_client_versions` stores only the most recent platform/version per account,
including project-version check-ins from Expo Go. It is self-reported telemetry,
not a list of devices, proof of standalone distribution, or proof that an older
device was retired. A second device can overwrite the first device's record.
Use the owner inventory alongside the recent-sign-in comparison in
[the release runbook](changelogs.md#release-and-update-availability-runbook).

Phase 3/4 gate: an ungated standalone install requires retirement, compatible
legacy status values, or a written exception accepting misleading `closed`
labels. Sign-off and compatibility evidence remain mandatory.

Phase 4 local check, 5 November 2026: legacy direct report/map/media/comment
queries were exercised under real authenticated RLS. Another resident and the
Mayor receive no raw source-report rows; scoped officers and the reporter retain
their authorized access. Legacy status values and transition wrappers remain.
This verifies API privacy and compatibility behavior, **not** acceptance of an
old installed application. No standalone holder was added and no version gate
was enabled. The owner subsequently authorized hosted Phase 4 deployment on
5 November 2026; it is applied and hosted role/access checks pass. The Expo Go
reload/phone walkthrough remains pending. Follow
[the Phase 4 phone checklist](phase4-expo-go-test-checklist.md); do not record R5
acceptance from the automated checks or from deployment alone.
