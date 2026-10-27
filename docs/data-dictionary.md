# Diccionario de Datos (Data Dictionary)

Modelo relacional previsto para la base de datos MySQL en FastAPI / SQLAlchemy.

## Entidades Principales

### 1. `users`
- `id`: INT, PK, AI.
- `username`: VARCHAR(50), UNIQUE, NOT NULL.
- `email`: VARCHAR(100), UNIQUE, NOT NULL.
- `hashed_password`: VARCHAR(255), NOT NULL.
- `budget`: DECIMAL(10,2), DEFAULT 100.00 (Millones de Euros).
- `created_at`: TIMESTAMP.

### 2. `players` (Leyendas)
- `id`: INT, PK, AI.
- `name`: VARCHAR(100), NOT NULL.
- `era`: VARCHAR(50) (e.g. '80s', '90s', '2000s').
- `natural_position`: ENUM('POR', 'DEF', 'MED', 'DEL'), NOT NULL.
- `overall_rating`: INT, NOT NULL (70-99).
- `price`: DECIMAL(10,2), NOT NULL (en millones, e.g. 15.50).
- `pace`: INT.
- `shooting`: INT.
- `passing`: INT.
- `dribbling`: INT.
- `defending`: INT.
- `physical`: INT.
- `photo_url`: VARCHAR(255).

### 3. `squads`
- `id`: INT, PK, AI.
- `user_id`: INT, FK -> `users.id`.
- `formation`: VARCHAR(10), NOT NULL (e.g., '4-3-3', '4-4-2').
- `total_spent`: DECIMAL(10,2), NOT NULL (Máx. 100.00).
- `is_valid`: BOOLEAN, DEFAULT TRUE.

### 4. `squad_players`
- `id`: INT, PK, AI.
- `squad_id`: INT, FK -> `squads.id`.
- `player_id`: INT, FK -> `players.id`.
- `assigned_position`: VARCHAR(10) (e.g., 'POR', 'DFC', 'MC', 'DC').
- `penalty_applied`: DECIMAL(4,2), DEFAULT 0.00 (0.15 a 0.25 si fuera de posición).
