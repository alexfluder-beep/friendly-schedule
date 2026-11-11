// Friendly Schedule: receives the nightly database copy and keeps it in Google Drive.
// Paste into a new project at script.google.com, run setup() once, then Deploy > New deployment > Web app
// (Execute as: Me, Who has access: Anyone) and give the web app URL to Claude.
// Keeps the last 30 copies in the Drive folder "Friendly Schedule backups" and emails you if a night was missed.

const FOLDER = 'Friendly Schedule backups';
const KEEP_DAYS = 30;

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);
    if (body.app !== 'friendly-schedule' || !body.data || !/^friendly-schedule-[\d-]+\.json\.gz$/.test(body.name || '')) return out({ ok: false });
    const bytes = Utilities.base64Decode(body.data);
    const folder = getFolder();
    const old = folder.getFilesByName(body.name);
    while (old.hasNext()) old.next().setTrashed(true);            // a second copy the same day replaces the first
    const file = folder.createFile(Utilities.newBlob(bytes, 'application/gzip', body.name));
    file.setDescription('Rows: ' + JSON.stringify(body.counts || {}));
    cleanup(folder);
    return out({ ok: true, id: file.getId(), size: bytes.length });
  } catch (err) {
    return out({ ok: false, error: String(err) });
  }
}

function getFolder() {
  const it = DriveApp.getFoldersByName(FOLDER);
  return it.hasNext() ? it.next() : DriveApp.createFolder(FOLDER);
}

function cleanup(folder) {
  const cut = Date.now() - KEEP_DAYS * 864e5;
  const it = folder.getFiles();
  while (it.hasNext()) { const f = it.next(); if (f.getDateCreated().getTime() < cut) f.setTrashed(true); }
}

// Every morning: if no copy arrived in the last 30 hours, send yourself an email.
function watch() {
  const it = getFolder().getFiles();
  let newest = 0;
  while (it.hasNext()) newest = Math.max(newest, it.next().getDateCreated().getTime());
  if (Date.now() - newest > 30 * 3600e3) {
    MailApp.sendEmail(Session.getActiveUser().getEmail(), 'Friendly Schedule: no backup last night',
      'No new copy arrived in the Drive folder "' + FOLDER + '". Check Supabase > Edge Functions > backup > Logs, or ask Claude.');
  }
}

// Run once: asks for Drive and email permission, makes the folder and the morning check.
function setup() {
  getFolder();
  ScriptApp.getProjectTriggers().forEach(t => { if (t.getHandlerFunction() === 'watch') ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('watch').timeBased().everyDays(1).atHour(9).inTimezone('Asia/Tbilisi').create();
}

function out(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}
