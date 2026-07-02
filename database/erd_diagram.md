# Database Entity-Relationship Diagram (ERD)

This document describes the schema structure and relationships of the Locket Clone SQLite Database.

## 1. ERD Diagram (Mermaid)

```mermaid
erDiagram
    USER {
        string id PK "UUID format"
        string username UNIQUE "alphanumeric"
        string email UNIQUE "email format"
        string password "hashed with bcrypt"
        string fullName "display name"
        datetime createdAt "default now"
    }
    
    FRIENDSHIP {
        string id PK "UUID format"
        string userId FK "initiator ID"
        string friendId FK "receiver ID"
        string status "PENDING, ACCEPTED"
        datetime createdAt "default now"
    }
    
    PHOTO {
        string id PK "UUID"
        string userId FK "uploader ID"
        string imageUrl "relative path to uploads"
        string caption "optional caption string"
        datetime createdAt "default now"
    }

    USER ||--o{ FRIENDSHIP : "initiates"
    USER ||--o{ FRIENDSHIP : "receives"
    USER ||--o{ PHOTO : "shares"
```

## 2. Table Specifications

### User
Stores all user accounts in the application.
- `id` (Text, Primary Key): Unique identifier of the user (UUID format).
- `username` (Text, Unique): Handle name used for searching.
- `email` (Text, Unique): User's registration email.
- `password` (Text): Hashed password using `bcryptjs`.
- `fullName` (Text): User's real name.

### Friendship
Tracks bidirectional friend requests and status.
- `id` (Text, Primary Key): Unique identifier.
- `userId` (Text, Foreign Key): The user who initiated the request.
- `friendId` (Text, Foreign Key): The user receiving the request.
- `status` (Text): Relationship state (`PENDING`, `ACCEPTED`).
- Unique Index: `(userId, friendId)` to prevent redundant invitations.

### Photo
Stores upload links and metadata for shared photos.
- `id` (Text, Primary Key): Unique photo identifier.
- `userId` (Text, Foreign Key): Refers to the creator of the moment.
- `imageUrl` (Text): Path to the saved file (relative link like `/uploads/...`).
- `caption` (Text, Nullable): Optional message.
