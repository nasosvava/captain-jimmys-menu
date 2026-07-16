# Railway deployment

## Required variables

Add these variables to the Railway service:

- `MENU_ADMIN_USERNAME`: the single owner username.
- `MENU_ADMIN_PASSWORD`: a long, unique password.

Do not upload `.env.local`; it is intentionally excluded from Git.

## Persistent menu edits

Attach a Railway Volume to the service with the mount path `/data`.
Railway provides `RAILWAY_VOLUME_MOUNT_PATH` automatically. On first access, the
application copies each bundled English and Greek menu into the empty volume.
Later edits are read from and written to the volume, so they survive restarts
and deployments.

## Deploy

1. Create a Railway project from the GitHub repository.
2. Add the two required variables above.
3. Attach a Volume mounted at `/data`.
4. Generate a public domain under the service Networking settings.

`railway.json` configures the build, dynamic Railway port, `/health` check, and
restart policy.
