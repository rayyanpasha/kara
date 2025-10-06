# Copilot Instructions for KARA Web App

## Project Overview
- **KARA** is a React-based civic-tech web app for youth-driven air quality action in Bengaluru.
- The app provides real-time AQI, a complaint/reporting system, AI-powered health tips, and a low-pollution route planner.
- Data is stored in Firebase Firestore; authentication is anonymous via Firebase Auth.
- 3D globe background is rendered with Three.js; GSAP is used for scroll-based globe animation.
- Tailwind CSS is used for all styling.

## Key Files & Structure
- `src/App.js`: Main React app, contains all major UI, logic, and data flows.
- `src/firebase.js`: Firebase config (duplicated inline in `App.js` for now).
- `public/index.html`: Loads GSAP, ScrollTrigger, and Leaflet via CDN. Mounts React app at `#root`.
- `public/assets/`: Contains globe textures and team images.
- `tailwind.config.js`, `postcss.config.js`, `src/index.css`: Tailwind setup.

## Developer Workflows
- **Start dev server:** `npm start`
- **Build for production:** `npm run build`
- No custom test scripts are present.
- All third-party JS (GSAP, Leaflet) is loaded via CDN in `public/index.html`.
- For 3D globe, assets must be present in `public/assets/`.

## Patterns & Conventions
- All UI is in React function components, using hooks for state/effects.
- Firestore collections: `complaints` (fields: userId, description, location, category, status, upvotes, timestamp).
- Anonymous sign-in is enforced on load; userId is used to filter personal reports.
- AI features (health tips, complaint draft, route planning) use Google Gemini API (API key in code, not secure for prod).
- Tailwind utility classes are used for all layout and style.
- 3D globe and map are rendered in background, not as main UI elements.
- No Redux or context API; all state is local to components.

## Integration Points
- **Firebase:** Firestore and Auth are initialized in `App.js` (and `firebase.js`).
- **Google Gemini API:** Used for AI features; endpoints are called directly from React components.
- **Leaflet:** Used for map rendering (community map in `working.js`).
- **Three.js:** Used for animated globe background.

## Project-Specific Notes
- Do not add server-side code; this is a static SPA.
- All sensitive keys are currently hardcoded for demo; do not expose in production.
- If adding new features, follow the single-file React component pattern in `App.js`.
- For new data, add new Firestore collections or fields as needed, but document them here.
- Use Tailwind for all new styles; do not use plain CSS.

## Example: Adding a New Feature
- Add a new React component in `App.js` or as a new file in `src/`.
- Use hooks for state/effects.
- Integrate with Firestore by importing from `firebase/firestore`.
- Style with Tailwind classes.
- If using AI, call Gemini API as in existing components.

---

For questions, see `App.js` for main patterns, or ask maintainers for architectural decisions.
