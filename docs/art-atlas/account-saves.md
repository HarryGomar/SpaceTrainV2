# Art Atlas account saves

The account page uses a Supabase passwordless email link and stores one versioned document per owner and save type. Galleries include room positions and wall placements. Saved paintings retain their original collection record. Quiz progress includes the recorded question definitions, answers, artwork information and earlier runs. Capturing a quiz resolves local archive references before saving.

Art Atlas saves on the device as people use it. On the account page, an email sign-in link gives access to optional uploads and restores. Restoring a copy keeps the previous device copy under Manage copies. The database enforces account ownership for reads and writes. Revisions prevent a stale page from overwriting a newer cloud copy.

## Local verification

The Supabase configuration is for local use. It listens on ports 56431 for the API and 56434 for the test inbox. Use the repository's Docker Desktop preflight before starting the local Supabase stack. The app reads ART_ATLAS_SUPABASE_URL and ART_ATLAS_SUPABASE_PUBLISHABLE_KEY at build time. A local anonymous key is supported for loopback development. Build the app and open /art-atlas/account.html through Vite on port 5173 or its preview on port 56439.

Run the account-saves and active-study-storage checks. For a database integration check, create two test accounts with the test inbox. Verify that one account can round-trip each kind of save and that the other account cannot read, insert, update or delete the first account's rows. Confirm that a write with a stale revision leaves the current save intact.

## Hosted settings

Apply the checked-in migration to the chosen Art Atlas project. Use the hosted project URL and public publishable key in the site's build settings. Add https://harrygomar.com/art-atlas/account.html as an allowed sign-in redirect. Supabase's default mail service is restricted to project team addresses. Configure a transactional SMTP provider before offering sign-in to other participants. [Supabase email delivery](https://supabase.com/docs/guides/auth/auth-smtp) · [Redirect URLs](https://supabase.com/docs/guides/auth/redirect-urls)
