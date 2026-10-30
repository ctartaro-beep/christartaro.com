// ==========================================================================
// photoframe (christartaro.com/photoframe) — configuration
// Random photos from a public Google Drive folder, matched to the shape of
// whatever screen is viewing: portrait photos on a portrait screen, landscape
// on landscape, re-matched when the device rotates or the window is resized.
// ==========================================================================

window.CONFIG = {
  // Same key as the family frame. Its allowed websites must include
  // https://christartaro.com/* for this page to load photos.
  GOOGLE_API_KEY: "AIzaSyAgA2IrOMxRlo8fEjTdUcAvp9y7-uMpavI",

  // The photoframe Drive folder (separate from the family frame's).
  // Shared "Anyone with the link — Viewer"; the ID is the end of its URL:
  // https://drive.google.com/drive/folders/<THIS_PART>
  DRIVE_FOLDER_ID: "PASTE_FOLDER_ID_HERE",

  // Match photo orientation to the screen. ?o=portrait / ?o=landscape / ?o=any
  // in the address still override this.
  ORIENTATION: "auto",

  PHOTO_INTERVAL_SECONDS: 10,
  PHOTOS_REFRESH_MINUTES: 5,

  // No wall clock for website visitors; double-tap the right half to show it.
  CLOCK_ON_BY_DEFAULT: false,
  CAPTION_ON_BY_DEFAULT: false,
  SHOW_FILENAME: false,
  SHOW_CAMERA: false,
};
