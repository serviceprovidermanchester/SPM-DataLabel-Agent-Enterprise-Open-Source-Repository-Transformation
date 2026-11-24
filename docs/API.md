# DataLabel REST API Specification

**Service Line:** AI Development Platform  
**Built & Maintained by:** [SPManchester Private Limited](https://www.spmanchester.com)  
**Lead Architect:** Sayed Mudassar Akbar  
**Base URL:** `http://localhost:4000/api/v1` (or configured `PORT`)

All API endpoints return JSON responses with consistent envelopes:
```json
{
  "ok": true,
  "data": { ... }
}
```
Errors return appropriate HTTP status codes (400, 401, 403, 404, 409, 500) formatted as:
```json
{
  "ok": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable explanation"
  }
}
```

---

## 1. System & Health

### `GET /health`
Returns system status, active database counts, and environment telemetry.
- **Auth:** None
- **Response:** `200 OK`
```json
{
  "ok": true,
  "data": {
    "status": "ok",
    "version": "1.0.0",
    "projectsLoaded": 1,
    "schemasLoaded": 2,
    "itemsLoaded": 18,
    "annotationsLoaded": 30
  }
}
```

---

## 2. Authentication & User Profile

### `POST /api/v1/auth/register`
Creates a new workspace owner account and initializes an isolated project.
- **Auth:** None
- **Body:** `{ "fullName": "string", "email": "string", "password": "string", "projectName": "string" }`
- **Response:** `201 Created`

### `POST /api/v1/auth/login`
Authenticates with email and scrypt password, returning a bearer session token.
- **Auth:** None
- **Body:** `{ "email": "string", "password": "string" }`
- **Response:** `200 OK` (includes session bearer token)

### `POST /api/v1/auth/logout`
Revokes the caller's active session token.
- **Auth:** Bearer Token
- **Response:** `200 OK`

### `GET /api/v1/auth/me`
Retrieves profile data for the authenticated account.
- **Auth:** Bearer Token
- **Response:** `200 OK`

### `PUT /api/v1/auth/me`
Updates caller profile attributes (full name, email, or password).
- **Auth:** Bearer Token
- **Response:** `200 OK`

---

## 3. Label Schemas & Items

### `GET /api/v1/schemas`
Lists all label schemas within the caller's project workspace.
- **Auth:** Bearer Token
- **Response:** `200 OK`

### `POST /api/v1/schemas`
Creates a new label schema. Optionally accepts inline items.
- **Auth:** Bearer Token
- **Body:**
```json
{
  "name": "Ticket Intent",
  "task": "Classify incoming customer support tickets",
  "labels": ["billing", "booking", "clinical"],
  "items": [
    { "ref": "TI-01", "text": "Can I get an invoice for treatment?", "source": "email" }
  ]
}
```
- **Response:** `201 Created` (Requires at least 2 distinct labels; returns 400 otherwise)

### `GET /api/v1/schemas/:id`
Retrieves detailed schema definition including ordered label sets and associated item inventory.
- **Auth:** Bearer Token
- **Response:** `200 OK` (404 if not found or belongs to another project)

### `POST /api/v1/schemas/:id/items`
Appends an item snippet to an existing schema.
- **Auth:** Bearer Token
- **Body:** `{ "ref": "DL-11", "text": "Broken tooth after injury", "source": "chat" }`
- **Response:** `201 Created`

### `GET /api/v1/items`
Queries items across schemas with pagination and filtering.
- **Auth:** Bearer Token
- **Response:** `200 OK`

### `GET /api/v1/items/:id`
Returns item text, reference, schema details, all submitted annotator annotations, and adjudication record (if settled).
- **Auth:** Bearer Token
- **Response:** `200 OK`

---

## 4. Annotator Profiles & Work Allocation

### `GET /api/v1/annotators`
Lists team members assigned to labeling or adjudication.
- **Auth:** Bearer Token
- **Response:** `200 OK`

### `POST /api/v1/annotators`
Registers a new annotator profile with role (`annotator` or `adjudicator`).
- **Auth:** Bearer Token
- **Body:** `{ "name": "Jane Doe", "email": "jane@example.com", "role": "annotator" }`
- **Response:** `201 Created`

### `POST /api/v1/assignments`
Assigns an item to an annotator.
- **Auth:** Bearer Token
- **Body:** `{ "schemaId": 1, "itemId": 5, "annotatorId": 2 }`
- **Response:** `201 Created` (Ensures item/annotator pair uniqueness)

---

## 5. Annotations & Progress Tracking

### `POST /api/v1/annotations`
Submits or updates a label choice for an assigned item.
- **Auth:** Bearer Token
- **Body:** `{ "assignmentId": 12, "label": "urgent", "note": "Severe pain reported" }`
- **Validation:** Label must exist in the schema's defined label set (returns 400 BAD_LABEL otherwise).
- **Response:** `201 Created` (Returns updated completion progress percentage)

---

## 6. Agreement & Adjudication

### `GET /api/v1/schemas/:id/agreement`
Calculates inter-annotator agreement between two annotators over doubly-labelled items.
- **Auth:** Bearer Token
- **Query Params:** `?annotatorA=<id>&annotatorB=<id>` (Defaults to first two active annotators if omitted)
- **Response:** `200 OK`
```json
{
  "ok": true,
  "data": {
    "agreement": {
      "items": 10,
      "agreed": 8,
      "disagreed": 2,
      "po": 0.8,
      "pe": 0.5,
      "kappa": 0.6,
      "interpretation": "moderate",
      "perLabel": [
        {
          "label": "urgent",
          "countA": 5,
          "countB": 5,
          "marginalA": 0.5,
          "marginalB": 0.5,
          "agreedOn": 4,
          "aOnly": 1,
          "bOnly": 1,
          "peContribution": 0.25
        }
      ],
      "disagreements": [
        { "itemId": 5, "itemRef": "DL-05", "labelA": "urgent", "labelB": "routine" }
      ]
    },
    "progress": [
      { "annotatorId": 1, "name": "Zara Ahmed", "done": 10, "total": 10, "percent": 100 }
    ]
  }
}
```

### `GET /api/v1/schemas/:id/disagreements`
Retrieves items with conflicting annotations pending senior adjudication.
- **Auth:** Bearer Token
- **Response:** `200 OK`

### `POST /api/v1/adjudications`
Resolves a disagreement by recording a definitive final label and rationale.
- **Auth:** Bearer Token
- **Body:** `{ "itemId": 5, "finalLabel": "urgent", "adjudicator": "Priya Shah", "note": "Requires same-day clinical slot" }`
- **Response:** `201 Created`

### `GET /api/v1/schemas/:id/export-summary`
Generates comprehensive export statistics reflecting resolved labels, source breakdown, and unresolved percentages.
- **Auth:** Bearer Token
- **Response:** `200 OK`

---

## 7. Workspace & Operations

### `GET /api/v1/dashboard`
Returns high-level project KPIs, headline Cohen's kappa, open disagreement counts, and completion statistics.
- **Auth:** Bearer Token
- **Response:** `200 OK`

### `GET /api/v1/project`
Retrieves workspace organization settings.
- **Auth:** Bearer Token
- **Response:** `200 OK`

### `PUT /api/v1/project`
Updates workspace profile (Owner permission required; Staff returns 403 Forbidden).
- **Auth:** Bearer Token (Owner)
- **Response:** `200 OK`

### `GET /api/v1/exports`
Lists historical export snapshots.
- **Auth:** Bearer Token
- **Response:** `200 OK`

### `POST /api/v1/exports`
Freezes and persists an export audit record with headline kappa.
- **Auth:** Bearer Token
- **Response:** `201 Created`

### `GET /api/v1/notifications`
Lists notifications for the user.
- **Auth:** Bearer Token
- **Response:** `200 OK`

### `PATCH /api/v1/notifications/read`
Marks user notifications as read.
- **Auth:** Bearer Token
- **Response:** `200 OK`
