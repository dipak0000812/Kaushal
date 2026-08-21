# Kaushal Frontend Routes & API Endpoint Directory

This document provides a directory of all frontend routes built during Phase 1 (Student Lane) and Phase 2 (T&P Lane) of the Kaushal platform. It maps each page to its local development URL, its main implementation file, and the backend/mock REST endpoints it consumes.

---

## Workspace Setup & Execution
The Next.js development server is executed from the `frontend/` directory:
```bash
npm run dev
```
By default, the application is accessible locally at `http://localhost:3000`.

---

## 1. Student Lane (Phase 1)

| Feature / Page | Local Dev URL | Implementation File | API Endpoints Consumed |
| :--- | :--- | :--- | :--- |
| **Student Dashboard** | [http://localhost:3000/student](http://localhost:3000/student) | [`app/student/page.tsx`](file:///Users/nihar/Desktop/CodeGround/Kaushal/frontend/app/student/page.tsx) | `GET /student/profile`<br>`GET /student/internships`<br>`GET /student/recommendations` |
| **Internship Detail View** | [http://localhost:3000/student/internships/[id]](http://localhost:3000/student/internships/internship-1) | [`app/student/internships/[id]/page.tsx`](file:///Users/nihar/Desktop/CodeGround/Kaushal/frontend/app/student/internships/%5Bid%5D/page.tsx) | `GET /student/profile`<br>`GET /student/internships/:id`<br>`POST /student/applications` |
| **Applications Directory** | [http://localhost:3000/student/applications](http://localhost:3000/student/applications) | [`app/student/applications/page.tsx`](file:///Users/nihar/Desktop/CodeGround/Kaushal/frontend/app/student/applications/page.tsx) | `GET /student/applications` (supports `?status=` parameter tabs) |
| **Application Detail View** | [http://localhost:3000/student/applications/[id]](http://localhost:3000/student/applications/app-1) | [`app/student/applications/[id]/page.tsx`](file:///Users/nihar/Desktop/CodeGround/Kaushal/frontend/app/student/applications/%5Bid%5D/page.tsx) | `GET /student/applications`<br>`PATCH /student/applications/:id/accept`<br>`PATCH /student/applications/:id/decline` |
| **Weekly Reports** | [http://localhost:3000/student/progress](http://localhost:3000/student/progress) | [`app/student/progress/page.tsx`](file:///Users/nihar/Desktop/CodeGround/Kaushal/frontend/app/student/progress/page.tsx) | `GET /student/applications`<br>`GET /student/progress-logs`<br>`POST /student/progress-logs` |
| **Documents Workspace** | [http://localhost:3000/student/documents](http://localhost:3000/student/documents) | [`app/student/documents/page.tsx`](file:///Users/nihar/Desktop/CodeGround/Kaushal/frontend/app/student/documents/page.tsx) | `GET /student/profile` |

---

## 2. T&P Lane (Phase 2)

| Feature / Page | Local Dev URL | Implementation File | API Endpoints Consumed |
| :--- | :--- | :--- | :--- |
| **T&P Dashboard** | [http://localhost:3000/tp](http://localhost:3000/tp) | [`app/tp/page.tsx`](file:///Users/nihar/Desktop/CodeGround/Kaushal/frontend/app/tp/page.tsx) | `GET /tnp/alerts` |
| **Verification & Override Queue** | [http://localhost:3000/tp/verification-queue](http://localhost:3000/tp/verification-queue) | [`app/tp/verification-queue/page.tsx`](file:///Users/nihar/Desktop/CodeGround/Kaushal/frontend/app/tp/verification-queue/page.tsx) | `GET /student/applications`<br>`GET /tnp/internships/pending-approval`<br>`PATCH /tnp/internships/:id/approve`<br>`PATCH /tnp/applications/:id/verify-offer`<br>`PATCH /tnp/applications/:id/reject-offer`<br>`POST /tnp/assignments`<br>`PATCH /tnp/applications/:id/override`<br>`GET /tnp/users` (to resolve Faculty list) |
| **Placement Analytics Console** | [http://localhost:3000/tp/analytics](http://localhost:3000/tp/analytics) | [`app/tp/analytics/page.tsx`](file:///Users/nihar/Desktop/CodeGround/Kaushal/frontend/app/tp/analytics/page.tsx) | `GET /tnp/analytics/dashboard`<br>`GET /tnp/alerts`<br>`GET /student/applications` |
| **Recruiter Directory** | [http://localhost:3000/tp/companies](http://localhost:3000/tp/companies) | [`app/tp/companies/page.tsx`](file:///Users/nihar/Desktop/CodeGround/Kaushal/frontend/app/tp/companies/page.tsx) | `GET /tnp/companies`<br>`POST /tnp/invites`<br>`PATCH /tnp/companies/:id/verify` |
| **User Provisioning** | [http://localhost:3000/tp/users](http://localhost:3000/tp/users) | [`app/tp/users/page.tsx`](file:///Users/nihar/Desktop/CodeGround/Kaushal/frontend/app/tp/users/page.tsx) | `GET /tnp/users`<br>`POST /tnp/users` (returns `409` conflict on duplicates) |
| **T&P Application Details** | [http://localhost:3000/tp/applications/[id]](http://localhost:3000/tp/applications/app-1) | [`app/tp/applications/[id]/page.tsx`](file:///Users/nihar/Desktop/CodeGround/Kaushal/frontend/app/tp/applications/%5Bid%5D/page.tsx) | `GET /student/applications`<br>`PATCH /tnp/applications/:id/cancel` |

---

## 3. Shared Components Utilized (Phase 0 Foundation)
These modular components are imported and reused dynamically across all workspace lanes:

*   **`<StatusStepper>`** ([`components/shared/StatusStepper.tsx`](file:///Users/nihar/Desktop/CodeGround/Kaushal/frontend/components/shared/StatusStepper.tsx)): Visualizes application lifecycle progress. Employs a fallback index mechanism that defaults to step 8 when timeline data is empty or truncated.
*   **`<EligibilityBreakdown>`** ([`components/shared/EligibilityBreakdown.tsx`](file:///Users/nihar/Desktop/CodeGround/Kaushal/frontend/components/shared/EligibilityBreakdown.tsx)): Side-by-side criteria analysis displaying student properties against corporate requirements.
*   **`<RiskBadge>`** ([`components/shared/RiskBadge.tsx`](file:///Users/nihar/Desktop/CodeGround/Kaushal/frontend/components/shared/RiskBadge.tsx)): Visualizes HIGH/MEDIUM/LOW placement and progress risks.
*   **`<ChartWrapper>`** ([`components/shared/ChartWrapper.tsx`](file:///Users/nihar/Desktop/CodeGround/Kaushal/frontend/components/shared/ChartWrapper.tsx)): Renders layout-isolated Recharts bar, line, and funnel graphics.
*   **`<WhatsNextPanel>`** ([`components/shared/WhatsNextPanel.tsx`](file:///Users/nihar/Desktop/CodeGround/Kaushal/frontend/components/shared/WhatsNextPanel.tsx)): Dynamic alert banner tailored individually for Student, Company, Faculty, and T&P roles.
