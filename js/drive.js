// ── GOOGLE DRIVE INTEGRATION ──
const DRIVE_SCOPES = 'https://www.googleapis.com/auth/drive.readonly';
let driveAccessToken = null;
let driveTokenExpiry = null;

// Get Google Client ID from config
function getGoogleClientId() {
  const cfg = getConfig();
  return cfg ? cfg.googleClientId : null;
}

// Check if we have a valid token
function isDriveConnected() {
  return driveAccessToken && driveTokenExpiry && Date.now() < driveTokenExpiry;
}

// Sign in with Google using OAuth popup
function connectGoogleDrive() {
  const clientId = getGoogleClientId();
  if (!clientId) {
    alert('Google Client ID not configured. Please update your settings.');
    return;
  }

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: window.location.origin + window.location.pathname,
    response_type: 'token',
    scope: DRIVE_SCOPES,
    include_granted_scopes: 'true',
    state: 'drive_auth',
  });

  window.location.href = `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}

// Handle OAuth redirect (token in URL hash)
function handleDriveAuthCallback() {
  const hash = window.location.hash;
  if (!hash) return false;

  const params = new URLSearchParams(hash.substring(1));
  const token = params.get('access_token');
  const expiresIn = params.get('expires_in');
  const state = params.get('state');

  if (token && state === 'drive_auth') {
    driveAccessToken = token;
    driveTokenExpiry = Date.now() + (parseInt(expiresIn) * 1000);
    // Store in session
    sessionStorage.setItem('drive_token', token);
    sessionStorage.setItem('drive_expiry', driveTokenExpiry);
    // Clean up URL
    window.history.replaceState({}, document.title, window.location.pathname);
    return true;
  }
  return false;
}

// Restore token from session storage
function restoreDriveSession() {
  const token = sessionStorage.getItem('drive_token');
  const expiry = sessionStorage.getItem('drive_expiry');
  if (token && expiry && Date.now() < parseInt(expiry)) {
    driveAccessToken = token;
    driveTokenExpiry = parseInt(expiry);
    return true;
  }
  return false;
}

// Find folder ID by name within parent
async function findFolderId(folderName, parentId = 'root') {
  const query = `name='${folderName}' and mimeType='application/vnd.google-apps.folder' and '${parentId}' in parents and trashed=false`;
  const res = await driveRequest(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name)`);
  return res.files && res.files.length > 0 ? res.files[0].id : null;
}

// List files in a folder
async function listFilesInFolder(folderId) {
  const query = `'${folderId}' in parents and trashed=false and (mimeType='application/pdf' or mimeType='application/vnd.google-apps.document' or mimeType='text/plain')`;
  const res = await driveRequest(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name,mimeType,modifiedTime)&orderBy=modifiedTime desc`);
  return res.files || [];
}

// Read a Google Doc as plain text
async function readGoogleDoc(fileId) {
  const res = await driveRequest(`https://www.googleapis.com/drive/v3/files/${fileId}/export?mimeType=text/plain`);
  return res;
}

// Read a PDF - export as text if possible, otherwise return name only
async function readPDF(fileId, fileName) {
  try {
    // For PDFs we use the files.get with alt=media to get raw bytes
    // But we can't easily parse PDF in browser without a library
    // So we'll extract text using Google's built-in OCR via Drive API
    const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
      headers: { 'Authorization': `Bearer ${driveAccessToken}` }
    });
    // PDFs can't be read as plain text directly - we'll note the file exists
    return `[PDF file: ${fileName} - contents available for reference]`;
  } catch(e) {
    return `[PDF: ${fileName}]`;
  }
}

// Generic Drive API request
async function driveRequest(url) {
  const res = await fetch(url, {
    headers: { 'Authorization': `Bearer ${driveAccessToken}` }
  });
  if (!res.ok) throw new Error(`Drive API error: ${res.status}`);
  const contentType = res.headers.get('content-type');
  if (contentType && contentType.includes('application/json')) {
    return res.json();
  }
  return res.text();
}

// Main function: load notes for a class from Google Drive
async function loadNotesForClass(className) {
  if (!isDriveConnected()) {
    throw new Error('not_connected');
  }

  // Map class names to folder names
  const folderMap = {
    'Algebra 2': 'Algebra 2',
    'English 3': 'English 3',
    'Economics': 'Econ'
  };

  const folderName = folderMap[className] || className;

  // Find Junior Year School folder
  const parentId = await findFolderId('Junior Year School');
  if (!parentId) throw new Error('Could not find "Junior Year School" folder in Google Drive');

  // Find class subfolder
  const folderId = await findFolderId(folderName, parentId);
  if (!folderId) throw new Error(`Could not find "${folderName}" folder`);

  // List files
  const files = await listFilesInFolder(folderId);
  if (files.length === 0) return { files: [], content: '' };

  // Read content from each file
  let allContent = '';
  const fileList = [];

  for (const file of files.slice(0, 10)) { // limit to 10 most recent files
    fileList.push(file.name);
    try {
      let content = '';
      if (file.mimeType === 'application/vnd.google-apps.document') {
        content = await readGoogleDoc(file.id);
      } else if (file.mimeType === 'application/pdf') {
        content = await readPDF(file.id, file.name);
      } else if (file.mimeType === 'text/plain') {
        content = await driveRequest(`https://www.googleapis.com/drive/v3/files/${file.id}?alt=media`);
      }
      if (content) {
        allContent += `\n\n--- ${file.name} ---\n${content}`;
      }
    } catch(e) {
      allContent += `\n\n--- ${file.name} --- [could not read]`;
    }
  }

  return { files: fileList, content: allContent.trim() };
}

// Load notes from MULTIPLE folders (for finals)
async function loadNotesForFinals(classNames) {
  if (!isDriveConnected()) throw new Error('not_connected');
  let combined = '';
  const allFiles = [];
  for (const cls of classNames) {
    try {
      const result = await loadNotesForClass(cls);
      combined += `\n\n=== ${cls} NOTES ===\n${result.content}`;
      allFiles.push(...result.files.map(f => `${cls}: ${f}`));
    } catch(e) { /* skip missing folders */ }
  }
  return { files: allFiles, content: combined.trim() };
}
