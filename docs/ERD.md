# ARAM PostgreSQL ERD

This is the testing-phase data model. Apply migrations in numeric order:

1. `supabase/migrations/0001_init.sql`
2. `supabase/migrations/0002_user_roles_and_student_details.sql`

```mermaid
erDiagram
    SCHOOL ||--o{ CHILD : contains
    SCHOOL ||--o{ USER_SCHOOL : serves
    APP_USER ||--o| CHILD : identifies
    APP_USER ||--o| STAFF_PROFILE : has
    APP_USER ||--o{ USER_SCHOOL : assigned_to
    APP_USER ||--o{ PARENT_STUDENT : guardian
    CHILD ||--o{ PARENT_STUDENT : belongs_to
    CHILD ||--|| STUDENT_PROFILE : has
    CHILD ||--|| STUDENT_CONSENT : controls
    CHILD ||--|| STUDENT_PREFERENCE : chooses
    CHILD ||--o{ SESSION : starts
    CHILD ||--o{ STUDENT_ASSESSMENT : completes
    SESSION ||--o{ STUDENT_ASSESSMENT : contains
    CHILD ||--o{ STUDENT_SUPPORT_EVENT : receives
    APP_USER ||--o{ STUDENT_SUPPORT_EVENT : records
    CHILD ||--o{ AUDIT_LOG : produces
    SESSION ||--o{ AUDIT_LOG : relates_to

    APP_USER {
        uuid id PK
        app_user_role role
        text display_name
        text preferred_language
        jsonb face_template
        uuid auth_user_id UK
        boolean is_active
    }

    SCHOOL {
        text emis PK
        text district
    }

    CHILD {
        uuid id PK
        uuid user_id FK,UK
        text school_id FK
        text nickname
        text age_group
        text pin_hash
        boolean parent_consent
        boolean child_assent
        boolean biometric_opt_in
        boolean voice_opt_in
        boolean locked
    }

    STAFF_PROFILE {
        uuid user_id PK,FK
        text employee_code UK
        text organisation_name
        text school_id FK
        text phone
        text email
    }

    USER_SCHOOL {
        uuid user_id PK,FK
        text school_id PK,FK
        text relationship PK
    }

    PARENT_STUDENT {
        uuid parent_user_id PK,FK
        uuid child_id PK,FK
        text relationship
        timestamptz verified_at
    }

    STUDENT_PROFILE {
        uuid child_id PK,FK
        text preferred_language
        text age_group
        text gender
        jsonb accessibility_needs
        jsonb learning_context
        jsonb trusted_contacts
        jsonb emergency_plan
    }

    STUDENT_CONSENT {
        uuid child_id PK,FK
        boolean parent_consent
        boolean child_assent
        boolean camera_opt_in
        boolean voice_opt_in
        timestamptz expires_at
    }

    STUDENT_PREFERENCE {
        uuid child_id PK,FK
        boolean speech_on
        text preferred_language
        text theme
    }

    SESSION {
        uuid id PK
        uuid child_id FK
        integer session_number
        text status
        text band
        boolean red_emergency_flag
    }

    STUDENT_ASSESSMENT {
        uuid id PK
        uuid child_id FK
        uuid session_id FK
        text assessment_type
        jsonb answers
        numeric score
        text band
    }

    STUDENT_SUPPORT_EVENT {
        uuid id PK
        uuid child_id FK
        uuid actor_user_id FK
        text event_type
        jsonb details
    }

    AUDIT_LOG {
        uuid id PK
        uuid child_id FK
        uuid session_id FK
        text event_type
        jsonb payload
    }
```

## Privacy boundaries

- `child` stores a nickname and coarse age group, never a date of birth or legal name.
- `app_user.face_template` stores a face descriptor only; captured photos are not stored.
- Student assessment answers and support details are JSONB so the schema can evolve, but access must remain behind audited RPCs.
- All application tables have RLS enabled. The browser should use RPCs rather than direct table access.
- `auth_user_id` is reserved for the eventual Supabase Auth identity; passwords should not be stored in these tables.

## Local testing

```bash
docker compose up -d
# PostgreSQL is available at localhost:5432
# database: aram, user: aram, password: aram-local-only

docker compose down
```

The initialization scripts run only when the `aram-postgres-data` volume is first created. To
re-run migrations from a clean database during testing:

```bash
docker compose down -v
docker compose up -d
```
