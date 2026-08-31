# Jamendo soundtracks

ShowCrafter can search Jamendo from the soundtrack step when the server-only
`JAMENDO_CLIENT_ID` environment variable is configured. The Jamendo account
username and password are never used by the application.

## Runtime flow

1. An authenticated active user submits an explicit search.
2. The server queries Jamendo and returns at most eight downloadable CC0 or
   CC BY tracks. Search and browse responses are cached briefly and requests are
   rate-limited per user.
3. Selecting a track makes the server revalidate its current licence and
   download permission, follows the official Jamendo file endpoint through
   allow-listed redirects, and uploads the MP3 under the user's private Supabase
   `audio` prefix.
4. ShowCrafter reserves the normal music-analysis credit, creates the
   `song_analyses` row, and starts the existing Modal analysis lifecycle.
5. Replacing or clearing the selection uses the same guarded cleanup path as a
   user upload.

The selected track's artist, Jamendo source page, and Creative Commons licence
are stored with the analysis and displayed in the wizard and replay.

## Production configuration

Add `JAMENDO_CLIENT_ID` in Vercel Project Settings > Environment Variables for
Production and Preview, then redeploy. It is a server-only developer
application identifier and must not use a `NEXT_PUBLIC_` prefix.

Jamendo's API terms permit free non-commercial API use and require artist,
provider, and source attribution. Confirm the appropriate Jamendo commercial
arrangement before enabling this feature for a commercial deployment.
