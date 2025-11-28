---
title: Data Model
owner: architect
version: 1.0
date: 2025-11-28
status: draft
---

### 1. ER Diagram (Mermaid)
```mermaid
erDiagram
    USER {
        UUID id PK
        VARCHAR email
        VARCHAR username
    }
    UPLOADED_TRACK {
        UUID id PK
        UUID user_id FK
        VARCHAR original_filename
        VARCHAR storage_url
        upload_status_enum upload_status
        analysis_status_enum analysis_status
        DECIMAL bpm
        VARCHAR key_signature
        DECIMAL duration_seconds
    }
    MASHUP {
        UUID id PK
        UUID user_id FK
        VARCHAR name
        INTEGER target_duration_seconds
        VARCHAR output_storage_url
        generation_status_enum generation_status
        INTEGER playback_count
        INTEGER download_count
    }
    MASHUP_INPUT_TRACK {
        UUID mashup_id PK,FK
        UUID uploaded_track_id PK,FK
    }

    USER ||--o{ UPLOADED_TRACK : uploads
    USER ||--o{ MASHUP : creates
    MASHUP ||--o{ MASHUP_INPUT_TRACK : includes
    UPLOADED_TRACK ||--o{ MASHUP_INPUT_TRACK : is_input_for
```

### 2. Table Schemas

**users**
| Column | Type | Constraints |
|---|---|---|
| id | UUID | PK |
| email | VARCHAR(255) | UNIQUE, NOT NULL |
| password_hash | VARCHAR(255) | NOT NULL |
| username | VARCHAR(100) | NULLABLE |
| created_at | TIMESTAMP | NOT NULL, DEFAULT CURRENT_TIMESTAMP |
| updated_at | TIMESTAMP | NOT NULL, DEFAULT CURRENT_TIMESTAMP |

**uploaded_tracks**
| Column | Type | Constraints |
|---|---|---|
| id | UUID | PK |
| user_id | UUID | FK users(id), NOT NULL |
| original_filename | VARCHAR(255) | NOT NULL |
| storage_url | VARCHAR(512) | NOT NULL |
| file_size_bytes | BIGINT | NOT NULL |
| mime_type | VARCHAR(50) | NOT NULL |
| upload_status | upload_status_enum | NOT NULL, DEFAULT 'pending' |
| analysis_status | analysis_status_enum | NOT NULL, DEFAULT 'pending' |
| bpm | DECIMAL(5,2) | NULLABLE |
| key_signature | VARCHAR(20) | NULLABLE |
| duration_seconds | DECIMAL(7,2) | NULLABLE |
| has_stems | BOOLEAN | NOT NULL, DEFAULT FALSE |
| created_at | TIMESTAMP | NOT NULL, DEFAULT CURRENT_TIMESTAMP |
| updated_at | TIMESTAMP | NOT NULL, DEFAULT CURRENT_TIMESTAMP |

**mashups**
| Column | Type | Constraints |
|---|---|---|
| id | UUID | PK |
| user_id | UUID | FK users(id), NOT NULL |
| name | VARCHAR(255) | NOT NULL |
| target_duration_seconds | INTEGER | NOT NULL |
| output_storage_url | VARCHAR(512) | NULLABLE |
| generation_status | generation_status_enum | NOT NULL, DEFAULT 'pending' |
| playback_count | INTEGER | NOT NULL, DEFAULT 0 |
| download_count | INTEGER | NOT NULL, DEFAULT 0 |
| created_at | TIMESTAMP | NOT NULL, DEFAULT CURRENT_TIMESTAMP |
| updated_at | TIMESTAMP | NOT NULL, DEFAULT CURRENT_TIMESTAMP |

**mashup_input_tracks**
| Column | Type | Constraints |
|---|---|---|
| mashup_id | UUID | PK, FK mashups(id) |
| uploaded_track_id | UUID | PK, FK uploaded_tracks(id) |
| created_at | TIMESTAMP | NOT NULL, DEFAULT CURRENT_TIMESTAMP |

### 3. Key Indexes
- `idx_users_email` on `users(email)`
- `idx_uploaded_tracks_user_id` on `uploaded_tracks(user_id)`
- `idx_mashups_user_id` on `mashups(user_id)`

### 4. Enums
```sql
CREATE TYPE upload_status_enum AS ENUM ('pending', 'uploaded', 'failed');
CREATE TYPE analysis_status_enum AS ENUM ('pending', 'analyzing', 'completed', 'failed');
CREATE TYPE generation_status_enum AS ENUM ('pending', 'generating', 'completed', 'failed');
```