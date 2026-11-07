-- =============================================================================
-- BASE DE DATOS OPTIMIZADA: Fantasy de Leyendas PWA (MySQL 3306)
-- Combina nueva_bd.sql + Métricas de Juego Completas (Stamina, Stats de Club y Popup Historial)
-- =============================================================================

DROP DATABASE IF EXISTS fantasy_leyendas;
CREATE DATABASE fantasy_leyendas CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE fantasy_leyendas;

-- -----------------------------------------------------------------------------
-- 1. USUARIOS / MÁNAGERS
-- -----------------------------------------------------------------------------
CREATE TABLE users (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(100) NULL,
    email VARCHAR(150) NOT NULL UNIQUE,
    hashed_password VARCHAR(255) NOT NULL,
    nombre VARCHAR(80) NOT NULL,
    apellido VARCHAR(80) NOT NULL,
    team_name VARCHAR(100) NOT NULL,
    rol ENUM('manager', 'admin') NOT NULL DEFAULT 'manager',
    fecha_nacimiento DATE NULL,
    photo_url VARCHAR(255) NULL,

    -- Economía y Competitivo
    presupuesto DECIMAL(6,2) NOT NULL DEFAULT 150.00,
    elo_rating SMALLINT UNSIGNED NOT NULL DEFAULT 1000,
    partidos_jugados SMALLINT UNSIGNED NOT NULL DEFAULT 0,
    victorias SMALLINT UNSIGNED NOT NULL DEFAULT 0,
    empates SMALLINT UNSIGNED NOT NULL DEFAULT 0,
    derrotas SMALLINT UNSIGNED NOT NULL DEFAULT 0,
    goles_favor SMALLINT UNSIGNED NOT NULL DEFAULT 0,
    goles_contra SMALLINT UNSIGNED NOT NULL DEFAULT 0,

    -- Preferencias del Mánager
    notif_activas BOOLEAN NOT NULL DEFAULT TRUE,
    sonido_activo BOOLEAN NOT NULL DEFAULT FALSE,
    auth_provider VARCHAR(20) NOT NULL DEFAULT 'local',

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_user_email (email),
    INDEX idx_user_elo (elo_rating DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci AUTO_ID_CACHE = 1;

-- -----------------------------------------------------------------------------
-- 2. CATÁLOGO DE 80 LEYENDAS (Atributos de juego + Métricas históricas para Comparativa)
-- -----------------------------------------------------------------------------
CREATE TABLE players (
    id INT PRIMARY KEY,
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

    -- Métricas P90 y Ratings por categoría (0 a 99)
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

    -- Economía y Valoración General
    precio DECIMAL(6,2) NOT NULL DEFAULT 0.00,
    rating_general INT NOT NULL DEFAULT 0,
    media_juego INT NOT NULL DEFAULT 0,

    INDEX idx_posicion (posicion_base),
    INDEX idx_media (media_juego DESC),
    INDEX idx_precio (precio)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci AUTO_ID_CACHE = 1;

-- -----------------------------------------------------------------------------
-- 3. CLUB / INVENTARIO DE JUGADORES FICHADOS POR USUARIO (Con Stamina y Stats en el Club)
-- -----------------------------------------------------------------------------
CREATE TABLE user_players (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id INT UNSIGNED NOT NULL,
    player_id INT NOT NULL,
    precio_compra DECIMAL(6,2) NOT NULL DEFAULT 0.00,

    -- Estado físico y rendimiento acumulado en el club del mánager
    energia TINYINT UNSIGNED NOT NULL DEFAULT 100,
    partidos_club SMALLINT UNSIGNED NOT NULL DEFAULT 0,
    goles_club SMALLINT UNSIGNED NOT NULL DEFAULT 0,
    vallas_invictas_club SMALLINT UNSIGNED NOT NULL DEFAULT 0,
    mvps_club SMALLINT UNSIGNED NOT NULL DEFAULT 0,
    rating_promedio DECIMAL(4,2) NOT NULL DEFAULT 0.00,

    adquirido_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE RESTRICT,
    UNIQUE KEY uk_user_player (user_id, player_id),
    INDEX idx_user_club (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci AUTO_ID_CACHE = 1;

-- -----------------------------------------------------------------------------
-- 4. ALINEACIONES TÁCTICAS (Configuraciones de cada mánager)
-- -----------------------------------------------------------------------------
CREATE TABLE plantillas (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id INT UNSIGNED NOT NULL,
    nombre VARCHAR(50) NOT NULL DEFAULT 'Mi Alineación Principal',
    formacion VARCHAR(10) NOT NULL DEFAULT '1-2-2-1',
    costo_total DECIMAL(6,2) NOT NULL DEFAULT 0.00,
    es_activa BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_plantilla_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci AUTO_ID_CACHE = 1;

-- -----------------------------------------------------------------------------
-- 5. JUGADORES EN LA ALINEACIÓN (6 Titulares y 4 Suplentes vinculados a user_players)
-- -----------------------------------------------------------------------------
CREATE TABLE plantilla_jugadores (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    plantilla_id INT UNSIGNED NOT NULL,
    user_player_id INT UNSIGNED NOT NULL,
    player_id INT NOT NULL,
    es_titular BOOLEAN NOT NULL DEFAULT TRUE,
    posicion_cancha VARCHAR(10) NOT NULL, -- 'SLOT_0'..'SLOT_9' o 'POR', 'DEF1', etc.
    orden TINYINT UNSIGNED NOT NULL DEFAULT 1,

    FOREIGN KEY (plantilla_id) REFERENCES plantillas(id) ON DELETE CASCADE,
    FOREIGN KEY (user_player_id) REFERENCES user_players(id) ON DELETE CASCADE,
    FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE RESTRICT,
    UNIQUE KEY uk_plantilla_posicion (plantilla_id, posicion_cancha),
    UNIQUE KEY uk_plantilla_user_player (plantilla_id, user_player_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci AUTO_ID_CACHE = 1;

-- -----------------------------------------------------------------------------
-- 6. PARTIDOS (Soporta PvP y vs IA + Estadísticas Detalladas y MVP para Popup Historial)
-- -----------------------------------------------------------------------------
CREATE TABLE partidos (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    local_user_id INT UNSIGNED NOT NULL,
    visitante_user_id INT UNSIGNED NULL,
    nombre_visitante_ia VARCHAR(100) NULL DEFAULT 'Leyendas Rival',

    plantilla_local_id INT UNSIGNED NOT NULL,
    plantilla_visitante_id INT UNSIGNED NULL,
    formacion_local VARCHAR(10) NOT NULL DEFAULT '1-2-2-1',
    formacion_visitante VARCHAR(10) NOT NULL DEFAULT '1-2-2-1',

    goles_local TINYINT UNSIGNED NOT NULL DEFAULT 0,
    goles_visitante TINYINT UNSIGNED NOT NULL DEFAULT 0,
    resultado ENUM('local', 'empate', 'visitante') NOT NULL,

    variacion_elo_local SMALLINT NOT NULL DEFAULT 0,
    variacion_elo_visitante SMALLINT NOT NULL DEFAULT 0,

    -- MVP del encuentro
    mvp_nombre VARCHAR(120) NULL,
    mvp_rol VARCHAR(10) NULL,
    mvp_rating DECIMAL(4,2) NULL,
    mvp_equipo ENUM('local', 'visitante') NULL DEFAULT 'local',

    -- Estadísticas cara a cara para el Popup de Historial
    posesion_local TINYINT UNSIGNED NOT NULL DEFAULT 50,
    posesion_visitante TINYINT UNSIGNED NOT NULL DEFAULT 50,
    tiros_local TINYINT UNSIGNED NOT NULL DEFAULT 0,
    tiros_visitante TINYINT UNSIGNED NOT NULL DEFAULT 0,
    atajadas_local TINYINT UNSIGNED NOT NULL DEFAULT 0,
    atajadas_visitante TINYINT UNSIGNED NOT NULL DEFAULT 0,
    amarillas_local TINYINT UNSIGNED NOT NULL DEFAULT 0,
    amarillas_visitante TINYINT UNSIGNED NOT NULL DEFAULT 0,
    rojas_local TINYINT UNSIGNED NOT NULL DEFAULT 0,
    rojas_visitante TINYINT UNSIGNED NOT NULL DEFAULT 0,

    seed_simulacion INT NULL,
    fecha_partido TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (local_user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (visitante_user_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (plantilla_local_id) REFERENCES plantillas(id) ON DELETE RESTRICT,
    FOREIGN KEY (plantilla_visitante_id) REFERENCES plantillas(id) ON DELETE SET NULL,
    INDEX idx_partidos_local (local_user_id),
    INDEX idx_partidos_visitante (visitante_user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci AUTO_ID_CACHE = 1;

-- -----------------------------------------------------------------------------
-- 7. EVENTOS DEL MINUTO A MINUTO (Timeline del partido en vivo)
-- -----------------------------------------------------------------------------
CREATE TABLE eventos_partido (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    partido_id INT UNSIGNED NOT NULL,
    minuto TINYINT UNSIGNED NOT NULL,
    segundo TINYINT UNSIGNED NOT NULL DEFAULT 0,
    tipo VARCHAR(50) NOT NULL, -- 'GOL', 'PARADA', 'DISPARO_POSTE', 'FALTA', 'TARJETA_AMARILLA', 'TARJETA_ROJA', 'CAMBIO'
    descripcion VARCHAR(255) NOT NULL,

    equipo ENUM('local', 'visitante') NOT NULL DEFAULT 'local',
    player_id INT NULL,
    jugador_nombre VARCHAR(120) NULL,

    FOREIGN KEY (partido_id) REFERENCES partidos(id) ON DELETE CASCADE,
    FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE SET NULL,
    INDEX idx_evento_minuto (partido_id, minuto)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci AUTO_ID_CACHE = 1;


