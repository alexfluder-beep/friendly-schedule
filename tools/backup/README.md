# Nightly backup to Google Drive

Every night at 03:00 Tbilisi Supabase runs the `backup` function. It copies all tables into one file
`friendly-schedule-YYYY-MM-DD.json.gz` and sends it to a small Google Apps Script in the owner's Google account,
which saves it in the Drive folder **Friendly Schedule backups**, keeps 30 days, and emails the owner if a night is missed.

Set up once (owner):
1. script.google.com > New project, name it "Friendly Schedule backup", paste `backup.gs`, Save.
2. Choose `setup` in the function list > Run > allow Drive and email access.
3. Deploy > New deployment > type Web app > Execute as **Me**, Who has access **Anyone** > Deploy > copy the Web app URL.
4. Give the URL to Claude (or run in Supabase SQL: `update public.backup_config set drive_url = '<url>' where id = 1;`).

Check: Supabase SQL `select last_at, last_result from public.backup_config;`
Restore: unzip the .json.gz; `tables` holds every table as rows; Claude can load it back into Supabase.
The file holds guest contacts and bank details: keep the Drive folder private.
