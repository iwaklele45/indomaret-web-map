# Agent Guidance for Indomaret Web Map

## Running the Project
- **Never open `index.html` directly** – browser blocks local CSV fetch.
- Start a local HTTP server from the project root:
  - `python -m http.server 8000` (then visit http://localhost:8000)
  - Alternatively, use VS Code with Live Server extension.
- The server must serve the `data/indomaret_stores_clean.csv` file via HTTP.

## Project Structure
- `index.html`: Main entry point (must be served via HTTP).
- `assets/css/style.css`: Styles.
- `assets/js/app.js`: Application logic (data loading, filtering, map rendering).
- `data/indomaret_stores_clean.csv`: Store data (see README for column details).

## Favicon
- A default favicon is configured via data URI in `index.html` (line 7)
- To change it, replace the `href` value in `<link rel="icon" href="...">` with your own icon file path or data URI

## Notes
- No build steps, package.json, tests, or linting.
- Uses Leaflet, Leaflet.markercluster, and PapaParse (loaded from CDN).
- Data validation logic is in `validateData()` (app.js) – filters rows based on name patterns.