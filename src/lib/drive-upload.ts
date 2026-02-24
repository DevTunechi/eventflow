// ─────────────────────────────────────────────
// src/lib/drive-upload.ts
//
// Uploads a file to the EventFlow service account
// Google Drive. Organises files into:
//
//   EventFlow (root)
//   └── {plannerEmail}/
//       └── {eventName}/
//           └── invitation-card.{ext}
//
// Returns a public shareable URL for the file.
// ─────────────────────────────────────────────

import { google } from "googleapis"
import { Readable } from "stream"

const SCOPES = ["https://www.googleapis.com/auth/drive"]

// ── Auth ──────────────────────────────────────
function getDriveClient() {
  const auth = new google.auth.JWT({
    email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    key:   process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    scopes: SCOPES,
  })
  return google.drive({ version: "v3", auth })
}

// ── Find or create a folder ───────────────────
async function getOrCreateFolder(
  drive: ReturnType<typeof google.drive>,
  name: string,
  parentId: string
): Promise<string> {
  // Check if folder already exists under parent
  const existing = await drive.files.list({
    q: `name='${name}' and mimeType='application/vnd.google-apps.folder' and '${parentId}' in parents and trashed=false`,
    fields: "files(id)",
    spaces: "drive",
  })

  if (existing.data.files?.length) {
    return existing.data.files[0].id!
  }

  // Create it
  const created = await drive.files.create({
    requestBody: {
      name,
      mimeType: "application/vnd.google-apps.folder",
      parents: [parentId],
    },
    fields: "id",
  })

  return created.data.id!
}

// ── Main upload function ──────────────────────
export async function uploadToDrive({
  buffer,
  filename,
  mimeType,
  plannerEmail,
  eventName,
}: {
  buffer:       Buffer
  filename:     string
  mimeType:     string
  plannerEmail: string
  eventName:    string
}): Promise<{ url: string; fileId: string }> {
  const drive      = getDriveClient()
  const rootFolder = process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID!

  // Sanitise folder names (remove chars Drive doesn't like)
  const safeEmail = plannerEmail.replace(/[<>:"/\\|?*]/g, "_")
  const safeEvent = eventName.replace(/[<>:"/\\|?*]/g, "_").slice(0, 60)

  // Build folder tree: root → planner → event
  const plannerFolder = await getOrCreateFolder(drive, safeEmail, rootFolder)
  const eventFolder   = await getOrCreateFolder(drive, safeEvent, plannerFolder)

  // Upload the file
  const uploaded = await drive.files.create({
    requestBody: {
      name:    filename,
      parents: [eventFolder],
    },
    media: {
      mimeType,
      body: Readable.from(buffer),
    },
    fields: "id",
  })

  const fileId = uploaded.data.id!

  // Make it publicly readable (anyone with link can view)
  await drive.permissions.create({
    fileId,
    requestBody: {
      role: "reader",
      type: "anyone",
    },
  })

  // Return a direct shareable link
  const url = `https://drive.google.com/file/d/${fileId}/view`

  return { url, fileId }
}