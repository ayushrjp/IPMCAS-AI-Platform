# Supabase Integration & Authentication Architecture — IPMCAS

## 1. Overview

IPMCAS leverages **Supabase** for PostgreSQL persistence and JWT-based user authentication.

### Key Security Principles
1. **Frontend Isolation**: Client browser code connects strictly using `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
2. **Backend Protection**: The `SUPABASE_SERVICE_ROLE_KEY` is maintained exclusively on the FastAPI backend server.
3. **No Identity Trust**: FastAPI protected API routes extract the user identity (`user_id`) strictly from the validated Bearer JWT token in the `Authorization` header.

---

## 2. Supabase Project Setup & Migration

### Step 1: Create Supabase Project
1. Log into [Supabase Dashboard](https://database.new).
2. Create a new project (e.g., `ipmcas-production`).
3. Copy API credentials from **Project Settings -> API**:
   - `Project URL` -> `NEXT_PUBLIC_SUPABASE_URL` & `SUPABASE_URL`
   - `anon / public key` -> `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role key` -> `SUPABASE_SERVICE_ROLE_KEY`

### Step 2: Apply Migration
Execute `database/migrations/001_initial_schema.sql` in the Supabase SQL Editor.

---

## 3. Row Level Security (RLS) Rules

| Table | RLS Enabled | Policy Definition | Public Read? |
|---|---|---|---|
| `profiles` | Yes | `auth.uid() = id` | No |
| `networks` | Yes | `auth.uid() = user_id` | No |
| `measurement_sessions` | Yes | `auth.uid() = user_id` | No |
| `measurement_results` | Yes | `auth.uid() = user_id` | No |
| `ai_conversations` | Yes | `auth.uid() = user_id` | No |
| `test_servers` | Yes | `auth.role() = 'service_role'` (Write), `true` (Read) | **Yes** |

---

## 4. FastAPI Bearer Token Auth Flow

```text
CLIENT (Next.js)                 FASTAPI BACKEND (apps/api)             SUPABASE AUTH
   │                                         │                                │
   │ 1. Sign In (Email/Password) ────────────┼───────────────────────────────>│
   │ <── 2. Return Session + JWT Access Token ┼────────────────────────────────┤
   │                                         │                                │
   │ 3. POST /api/v1/measurements/session/start                               │
   │    Header: Authorization: Bearer <token>│                                │
   │ ───────────────────────────────────────>│                                │
   │                                         │ 4. Validate JWT Token Claims   │
   │                                         │    Extract authenticated user_id│
   │                                         │ 5. Create Session Bound to user_id
   │ <── 6. Return session_id ────────────────┤                                │
```
