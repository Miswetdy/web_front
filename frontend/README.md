Frontend React+TypeScript app for the Year Determination lab.

How to run:
1. cd frontend
2. npm install
3. npm start

This version uses TypeScript and the app root component is `YearDeterminationApp` (in `src/YearDeterminationApp.tsx`).

Project structure highlights:
- src/year_pages — страницы (YearHome.tsx, YearPersonDetail.tsx)
- src/year_components — компоненты (YearPersonCard.tsx, YearBreadcrumbs.tsx)
- src/year_api — API wrapper (YearApi.ts)
- src/year_types — TypeScript типы (YearTypes.ts)
- root-level files to match old naming style: `YearApp.css`, `YearMain.tsx`, `YearApi.ts`, `YearServiceTypes.ts`

Example file names (to match your previous template style):
- YearHome.tsx / YearHome.css
- YearPersonDetail.tsx / YearPersonDetail.css
- YearPersonCard.tsx / YearPersonCard.css

Fetch calls include a fallback to mock data if the backend is unavailable (use `?mock=1` to force mock on backend).
