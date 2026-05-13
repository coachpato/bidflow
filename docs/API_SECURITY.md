# API Security Requirements

Bid360 protects browser sessions with a same-site session cookie. Any `POST`, `PATCH`, or `DELETE` request to `/api/*` must also include one of these headers:

```http
X-Requested-With: XMLHttpRequest
```

or:

```http
X-Bid360-CSRF: 1
```

First-party browser code installs this header automatically for same-origin `/api/*` fetch calls. Mobile apps, trusted integrations, and operational scripts must set the header explicitly when they call mutating API routes.

Unauthenticated API requests return JSON:

```json
{ "error": "Unauthorized" }
```

Page requests without a valid session continue to redirect to `/login`.
