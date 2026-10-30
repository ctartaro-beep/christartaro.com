# christartaro.com

Static portfolio site for Chris Tartaro, hosted on GitHub Pages. No build step.

## Files

- `data/videos.json` holds every page, section and video. This is the only file you need to touch for content changes.
- `index.html`, `styles.css`, `app.js` hold the layout, look and behavior.
- `img/` holds the video thumbnails, copied off Squarespace.
- `photoframe/` is a full-screen random-photo slideshow fed by a public Google Drive folder. It shows portrait photos on portrait screens and landscape on landscape. Its look and behavior load from the family frame repo (`ctartaro-beep/photoframe`); only `photoframe/config.js` lives here.
- `ctmdb/` (Music DB) and `ctmdb2/` (Musical Memoir) are standalone pages, unlisted in the menu. Their code was moved over from Squarespace as-is.

## Adding a video

Add an entry to the right section in `data/videos.json`:

```json
{ "title": "Sketch name", "youtube": "VIDEO_ID", "thumb": "img/sketch-name.jpg" }
```

Use `"vimeo": "123456789"` instead of `youtube` for Vimeo (add `"hash"` for unlisted Vimeo links). `"start": 34` starts a YouTube video at 0:34. `"description"` is optional. If `thumb` is empty or missing, the card shows the title on a dark panel.

## Shuffle-only videos

Videos listed in `site.shuffleExtras` in `data/videos.json` are in the Shuffle (and can be linked from the About text) without appearing on any page. `"roles": ["Edited"]` sets the credit the shuffle player shows.

About paragraphs can link with `[text](url)` and set show titles in bold italic with `***Title***`. A link to one of the site's own Vimeo or YouTube videos plays in the site's viewer.

## After any change

Bump the `?v=` number on `styles.css` and `app.js` in `index.html` (any new value, e.g. the date and time). Browsers cache each file for 10 minutes; the shared version makes them pick up the new script, styles and data together.

## Preview locally

```sh
python3 -m http.server 8000
```

Then open http://localhost:8000.

## Going live

1. Push this repo to GitHub and enable Pages (Settings → Pages → Deploy from branch → `main`, `/`).
2. Add a `CNAME` file containing `christartaro.com` (or set the custom domain in Settings → Pages), then tick **Enforce HTTPS**.
3. In your GitHub account settings → Pages, verify the domain (protects against takeover).
4. At the domain registrar, point DNS at GitHub Pages: four `A` records for `@` (185.199.108.153, 185.199.109.153, 185.199.110.153, 185.199.111.153) and a `CNAME` for `www` to `<username>.github.io`.
