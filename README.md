# FindBack — College Lost & Found

A full-stack lost-and-found portal for colleges. Students can create lost/found reports, search and filter reports, view possible matches, submit claims, and manage their own reports.

## Stack
- React + Vite frontend
- Express REST API
- MongoDB/Mongoose database
- JWT authentication and bcrypt password hashing

## Requirements
- Node.js 20+
- MongoDB locally OR a MongoDB Atlas connection string

## Run locally (Windows PowerShell / CMD)
1. Extract this folder.
2. Open a terminal in the **FindBack-Reimagined root folder** (the folder containing this README and package.json).
3. Run `npm run install:all`.
4. Copy `backend/.env.example` to `backend/.env`.
5. Set `MONGODB_URI` and replace `JWT_SECRET` with a long random secret.
6. Start MongoDB locally if using a local database.
7. Run `npm run dev`.
8. Open http://localhost:5173. API health check: http://localhost:8080/api/health

Important: `npm run install:all` must be run from the root folder, not from `frontend` or `backend`.

## Environment variables (`backend/.env`)
- `PORT=8080`
- `MONGODB_URI=mongodb://127.0.0.1:27017/findback`
- `JWT_SECRET=replace-with-a-long-random-secret`
- `CLIENT_URL=http://localhost:5173`

## Main features
- Register/login with hashed passwords and JWT sessions
- Create lost/found reports with optional image URL
- Search and filter reports by type, category, and keyword
- Server-side possible-match scoring (category, item title, description, location, date)
- Submit claims and let the report owner approve/reject them
- Mark a report as resolved
- Personal dashboard for reports and claims
- Responsive layout for desktop/mobile

## Deployment outline
1. Create a MongoDB Atlas cluster and database user; allow only the IP access you need (or configure your provider's recommended network access).
2. Deploy `backend` to Render as a Node web service. Build command: `npm install`; start command: `npm start`. Set `MONGODB_URI`, `JWT_SECRET`, `CLIENT_URL`.
3. Deploy `frontend` to Vercel. Set `VITE_API_URL` to the deployed API base URL, e.g. `https://your-api.onrender.com/api`.
4. Set the backend `CLIENT_URL` to your deployed frontend URL.
5. Test registration, login, posting, matching, claims, and resolving using two separate accounts.

## Real-world safety notes
- Do not publish private phone numbers or email addresses in public report descriptions.
- Meet in a public place such as the college office/security desk to return valuable items.
- For production, configure email verification, rate limiting, moderation/reporting, HTTPS, backups, and an image-storage provider such as Cloudinary or S3. This starter stores image URLs, not uploaded image files.


## Private contact and SMS alerts

- Phone numbers are collected at registration in international format (for example `+919876543210`) and are never displayed on public report cards.
- A claim does **not** automatically resolve a report. The report stays open until the owner accepts a claim and confirms the item was actually returned; only then use **Mark recovered** in the dashboard.
- The claimant and report owner can see each other's supplied contact details only after a claim is accepted. Users should arrange handover in a public campus place.
- Real SMS alerts are optional and require a Twilio account, a sender number, and valid credentials. Set `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, and `TWILIO_FROM_NUMBER` in `backend/.env`. The recipient must have a valid international-format phone number. Twilio may require sender registration/verification and messaging compliance approval in your country. Without those credentials, the app cannot send real SMS; notifications are not faked.
- For existing accounts created before the phone field was added, users must register a new account or add a phone field through a secure profile-update feature before they can receive SMS alerts. Do not expose `.env` secrets or commit them to GitHub.
