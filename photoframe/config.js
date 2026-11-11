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
  DRIVE_FOLDER_ID: "1z7b1dBhe-0OQu9AvFV74iQPGjyCIcJuA",

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

  // Generative ambient music steered by each photo (music.js, this page only).
  // Double-tap the top of the screen, or press "m", to turn it on/off; that
  // choice is remembered. ?music=off in the address forces it off.
  MUSIC_ON_BY_DEFAULT: true,
  MUSIC_VOLUME: 0.5,   // 0 to 1
  MUSIC_KEY: "D",      // the drone's note: C, C#, D, Eb, E ... B

  // The only chords the music uses. Each photo's main color picks one; the
  // first is "home" (photos with little color). Names like Dm7(9), Fm6,
  // Cmaj7, G7sus4, Bbmaj9, or exact notes: ["D3", "A3", "C4", "E4", "F4"].
  MUSIC_CHORDS: ["Dm7(9)", "Dm7", "Dm7(b5)", "Fm6", "C maj 7"],
};
