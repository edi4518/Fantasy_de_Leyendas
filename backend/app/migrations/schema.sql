-- =============================================================================
-- BASE DE DATOS: Fantasy de Leyendas PWA
-- Script de Creación de Esquema Completo (schema.sql)
-- =============================================================================

DROP DATABASE IF EXISTS fantasy_leyendas;

CREATE DATABASE fantasy_leyendas
CHARACTER SET utf8mb4
COLLATE utf8mb4_unicode_ci;

USE fantasy_leyendas;

-- -----------------------------------------------------------------------------
-- 1. TABLA: users (Mánagers / Clase Usuario del diagrama)
-- -----------------------------------------------------------------------------
CREATE TABLE users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(100) NULL,
    email VARCHAR(150) NOT NULL UNIQUE,
    hashed_password VARCHAR(255) NOT NULL,
    nombre VARCHAR(100) NOT NULL,
    apellido VARCHAR(100) NOT NULL,
    team_name VARCHAR(100) NOT NULL,
    rol VARCHAR(50) NOT NULL DEFAULT 'manager',
    fecha_nacimiento DATE NULL,
    photo_url VARCHAR(255) NULL,
    presupuesto DECIMAL(6,2) NOT NULL DEFAULT 100.00, -- 100M disponibles
    elo_rating INT NOT NULL DEFAULT 1000,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_user_email (email),
    INDEX idx_user_elo (elo_rating DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 2. TABLA: players (Catálogo de 80 Leyendas / Clase Leyenda del diagrama)
-- Coincide exactamente con las 51 columnas de players_seed.csv
-- -----------------------------------------------------------------------------
CREATE TABLE players (
    id INT PRIMARY KEY, -- ID secuencial 1 al 80 fijado en el seed
    nombre VARCHAR(120) NOT NULL,
    posicion_base ENUM('POR', 'DEF', 'MC', 'DEL') NOT NULL,
    posicion_detalle VARCHAR(60) NOT NULL,
    nacionalidad VARCHAR(80) NOT NULL,
    
    -- Métricas de volumen histórico
    partidos_oficiales INT DEFAULT 0,
    minutos_jugados INT DEFAULT 0,
    vallas_invictas INT DEFAULT 0,
    goles_oficiales INT DEFAULT 0,
    remates_totales INT DEFAULT 0,
    asistencias_oficiales INT DEFAULT 0,
    pases_intentados INT DEFAULT 0,
    pases_completados INT DEFAULT 0,
    pases_clave INT DEFAULT 0,
    regates_intentados INT DEFAULT 0,
    regates_exitosos INT DEFAULT 0,
    recuperaciones INT DEFAULT 0,
    intercepciones INT DEFAULT 0,
    entradas_exitosas INT DEFAULT 0,
    duelos_defensivos_totales INT DEFAULT 0,
    duelos_defensivos_ganados INT DEFAULT 0,
    ocasiones_creadas INT DEFAULT 0,
    goles_sin_penal INT DEFAULT 0,
    distinciones_individuales INT DEFAULT 0,
    balones_de_oro INT DEFAULT 0,
    titulos_totales INT DEFAULT 0,
    
    -- Métricas P90 y porcentajes calculados
    goles_sin_penal_p90 DECIMAL(6,2) DEFAULT 0.00,
    goles_p90 DECIMAL(6,2) DEFAULT 0.00,
    conversion_goles DECIMAL(6,2) DEFAULT 0.00,
    rating_ataque INT NOT NULL DEFAULT 0,
    asistencias_p90 DECIMAL(6,2) DEFAULT 0.00,
    pases_clave_p90 DECIMAL(6,2) DEFAULT 0.00,
    ocasiones_creadas_p90 DECIMAL(6,2) DEFAULT 0.00,
    rating_creacion INT NOT NULL DEFAULT 0,
    porcentaje_regates DECIMAL(6,2) DEFAULT 0.00,
    precision_pases DECIMAL(6,2) DEFAULT 0.00,
    rating_tecnica INT NOT NULL DEFAULT 0,
    porcentaje_duelos_defensivos DECIMAL(6,2) DEFAULT 0.00,
    entradas_exitosas_p90 DECIMAL(6,2) DEFAULT 0.00,
    intercepciones_p90 DECIMAL(6,2) DEFAULT 0.00,
    recuperaciones_p90 DECIMAL(6,2) DEFAULT 0.00,
    rating_defensa INT NOT NULL DEFAULT 0,
    duelos_ganados_p90 DECIMAL(6,2) DEFAULT 0.00,
    rating_fisico INT NOT NULL DEFAULT 0,
    distinciones_norm DECIMAL(6,2) DEFAULT 0.00,
    balones_oro_norm DECIMAL(6,2) DEFAULT 0.00,
    titulos_norm DECIMAL(6,2) DEFAULT 0.00,
    rating_palmares INT NOT NULL DEFAULT 0,
    
    -- Economía y Ratings del juego
    precio DECIMAL(6,2) NOT NULL DEFAULT 0.00,
    rating_general INT NOT NULL DEFAULT 0,
    media_juego INT NOT NULL DEFAULT 0,

    INDEX idx_posicion_base (posicion_base),
    INDEX idx_precio (precio),
    INDEX idx_media_juego (media_juego DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 3. TABLA: plantillas (Clase Plantilla del diagrama)
-- -----------------------------------------------------------------------------
CREATE TABLE plantillas (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    formacion VARCHAR(20) NOT NULL DEFAULT '1-2-2-1',
    costo_total DECIMAL(6,2) NOT NULL DEFAULT 0.00,
    es_activa BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_plantilla_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 4. TABLA: plantilla_jugadores (Asociación 6 Titulares y 3 Suplentes)
-- -----------------------------------------------------------------------------
CREATE TABLE plantilla_jugadores (
    id INT AUTO_INCREMENT PRIMARY KEY,
    plantilla_id INT NOT NULL,
    player_id INT NOT NULL,
    es_titular BOOLEAN NOT NULL DEFAULT TRUE, -- TRUE = titular, FALSE = suplente
    posicion_cancha VARCHAR(10) NOT NULL,    -- 'POR', 'DEF1', 'DEF2', 'MC1', etc.
    FOREIGN KEY (plantilla_id) REFERENCES plantillas(id) ON DELETE CASCADE,
    FOREIGN KEY (player_id) REFERENCES players(id),
    UNIQUE KEY uk_plantilla_player (plantilla_id, player_id),
    INDEX idx_pj_plantilla (plantilla_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 5. TABLA: partidos (Clase ResultadoPartido del diagrama)
-- -----------------------------------------------------------------------------
CREATE TABLE partidos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    plantilla_id INT NOT NULL,
    rival_nombre VARCHAR(100) NOT NULL DEFAULT 'Leyendas Rival',
    goles_local INT NOT NULL DEFAULT 0,
    goles_visitante INT NOT NULL DEFAULT 0,
    resultado ENUM('victoria', 'empate', 'derrota') NOT NULL,
    variacion_elo INT NOT NULL DEFAULT 0,
    seed_utilizada INT NULL,
    fecha_partido TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (plantilla_id) REFERENCES plantillas(id),
    INDEX idx_partido_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 6. TABLA: eventos_partido (Clase Evento del diagrama)
-- -----------------------------------------------------------------------------
CREATE TABLE eventos_partido (
    id INT AUTO_INCREMENT PRIMARY KEY,
    partido_id INT NOT NULL,
    minuto INT NOT NULL,
    tipo VARCHAR(50) NOT NULL, -- 'GOL', 'FALTA', 'TARJETA_AMARILLA', 'PARADA'
    descripcion TEXT NOT NULL,
    player_id INT NULL,
    FOREIGN KEY (partido_id) REFERENCES partidos(id) ON DELETE CASCADE,
    FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE SET NULL,
    INDEX idx_evento_partido (partido_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;