import os
import csv
import logging
from typing import Generator
from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import declarative_base, sessionmaker, Session
from app.core.config import settings

logger = logging.getLogger("app.database")

Base = declarative_base()


def create_db_engine():
    """Intenta conectar a MySQL / TiDB Cloud / PostgreSQL (Supabase) según settings.DATABASE_URL.
    Si la BD remota o local no responde, realiza un fallback automático a SQLite local.
    """
    db_url = settings.DATABASE_URL.strip()
    if db_url.startswith("postgres://"):
        db_url = db_url.replace("postgres://", "postgresql://", 1)

    try:
        connect_args = {}
        if "mysql" in db_url:
            connect_args["connect_timeout"] = 5
            if "tidbcloud.com" in db_url or "ssl=" in db_url:
                connect_args["ssl"] = {"check_hostname": False}

        # Ejecutar CREATE DATABASE IF NOT EXISTS fantasy_leyendas tanto en MySQL local como en TiDB Cloud
        if "mysql" in db_url and "/fantasy_leyendas" in db_url:
            base_mysql_url = db_url.rsplit("/fantasy_leyendas", 1)[0]
            if "tidbcloud.com" in base_mysql_url:
                base_mysql_url = f"{base_mysql_url}/test"
            temp_eng = create_engine(base_mysql_url, connect_args=connect_args)
            with temp_eng.connect() as conn:
                conn.execute(
                    text(
                        "CREATE DATABASE IF NOT EXISTS fantasy_leyendas "
                        "CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"
                    )
                )
                conn.commit()
            temp_eng.dispose()

        eng = create_engine(
            db_url,
            pool_pre_ping=True,
            pool_recycle=300,
            connect_args=connect_args
        )
        with eng.connect() as conn:
            conn.execute(text("SELECT 1"))
        logger.info("Conexión exitosa a la base de datos configurada en DATABASE_URL")
        return eng
    except Exception as e:
        logger.warning(
            f"No se pudo conectar a MySQL en localhost ({e}). "
            "Activando fallback automático a SQLite local."
        )
        sqlite_file = os.path.abspath(
            os.path.join(os.path.dirname(__file__), "..", "..", "fantasy_leyendas.db")
        )
        if not os.access(os.path.dirname(sqlite_file), os.W_OK):
            sqlite_file = "/tmp/fantasy_leyendas.db"
        sqlite_url = f"sqlite:///{sqlite_file}"
        eng = create_engine(sqlite_url, connect_args={"check_same_thread": False})
        return eng


engine = create_db_engine()
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def _ensure_optimized_schema():
    """Actualiza automáticamente el esquema en MySQL/SQLite si proviene de la versión anterior de 6 tablas,
    preservando los usuarios registrados y las 80 leyendas."""
    try:
        insp = inspect(engine)
        existing_tables = set(insp.get_table_names())

        # 1.0 Asegurar TODAS las columnas requeridas en 'players' (incluyendo métricas históricas)
        if "players" in existing_tables:
            player_cols = {c["name"] for c in insp.get_columns("players")}
            player_definitions = [
                ("partidos_oficiales", "INT DEFAULT 0"),
                ("minutos_jugados", "INT DEFAULT 0"),
                ("vallas_invictas", "INT DEFAULT 0"),
                ("goles_oficiales", "INT DEFAULT 0"),
                ("remates_totales", "INT DEFAULT 0"),
                ("asistencias_oficiales", "INT DEFAULT 0"),
                ("pases_intentados", "INT DEFAULT 0"),
                ("pases_completados", "INT DEFAULT 0"),
                ("pases_clave", "INT DEFAULT 0"),
                ("regates_intentados", "INT DEFAULT 0"),
                ("regates_exitosos", "INT DEFAULT 0"),
                ("recuperaciones", "INT DEFAULT 0"),
                ("intercepciones", "INT DEFAULT 0"),
                ("entradas_exitosas", "INT DEFAULT 0"),
                ("duelos_defensivos_totales", "INT DEFAULT 0"),
                ("duelos_defensivos_ganados", "INT DEFAULT 0"),
                ("ocasiones_creadas", "INT DEFAULT 0"),
                ("goles_sin_penal", "INT DEFAULT 0"),
                ("distinciones_individuales", "INT DEFAULT 0"),
                ("balones_de_oro", "INT DEFAULT 0"),
                ("titulos_totales", "INT DEFAULT 0"),
                ("goles_sin_penal_p90", "DECIMAL(6,2) DEFAULT 0.00"),
                ("goles_p90", "DECIMAL(6,2) DEFAULT 0.00"),
                ("conversion_goles", "DECIMAL(6,2) DEFAULT 0.00"),
                ("rating_ataque", "INT NOT NULL DEFAULT 0"),
                ("asistencias_p90", "DECIMAL(6,2) DEFAULT 0.00"),
                ("pases_clave_p90", "DECIMAL(6,2) DEFAULT 0.00"),
                ("ocasiones_creadas_p90", "DECIMAL(6,2) DEFAULT 0.00"),
                ("rating_creacion", "INT NOT NULL DEFAULT 0"),
                ("porcentaje_regates", "DECIMAL(6,2) DEFAULT 0.00"),
                ("precision_pases", "DECIMAL(6,2) DEFAULT 0.00"),
                ("rating_tecnica", "INT NOT NULL DEFAULT 0"),
                ("porcentaje_duelos_defensivos", "DECIMAL(6,2) DEFAULT 0.00"),
                ("entradas_exitosas_p90", "DECIMAL(6,2) DEFAULT 0.00"),
                ("intercepciones_p90", "DECIMAL(6,2) DEFAULT 0.00"),
                ("recuperaciones_p90", "DECIMAL(6,2) DEFAULT 0.00"),
                ("rating_defensa", "INT NOT NULL DEFAULT 0"),
                ("duelos_ganados_p90", "DECIMAL(6,2) DEFAULT 0.00"),
                ("rating_fisico", "INT NOT NULL DEFAULT 0"),
                ("distinciones_norm", "DECIMAL(6,2) DEFAULT 0.00"),
                ("balones_oro_norm", "DECIMAL(6,2) DEFAULT 0.00"),
                ("titulos_norm", "DECIMAL(6,2) DEFAULT 0.00"),
                ("rating_palmares", "INT NOT NULL DEFAULT 0"),
                ("precio", "DECIMAL(6,2) NOT NULL DEFAULT 0.00"),
                ("rating_general", "INT NOT NULL DEFAULT 0"),
                ("media_juego", "INT NOT NULL DEFAULT 0"),
            ]
            added_any_player_col = False
            with engine.begin() as conn:
                for col_name, col_def in player_definitions:
                    if col_name not in player_cols:
                        try:
                            conn.execute(text(f"ALTER TABLE players ADD COLUMN {col_name} {col_def}"))
                            added_any_player_col = True
                        except Exception as add_err:
                            logger.warning(f"No se pudo agregar columna {col_name} en players: {add_err}")

            # Si agregamos columnas o si los datos de métricas están en 0, actualizamos desde players_seed.csv
            if added_any_player_col:
                csv_path = os.path.abspath(
                    os.path.join(os.path.dirname(__file__), "..", "seed", "players_seed.csv")
                )
                if os.path.exists(csv_path):
                    with open(csv_path, mode="r", encoding="utf-8") as f:
                        reader = csv.DictReader(f)
                        with engine.begin() as conn:
                            for row in reader:
                                pid = int(row["id"])
                                conn.execute(
                                    text("""
                                        UPDATE players SET
                                            partidos_oficiales = :partidos_oficiales,
                                            minutos_jugados = :minutos_jugados,
                                            vallas_invictas = :vallas_invictas,
                                            goles_oficiales = :goles_oficiales,
                                            remates_totales = :remates_totales,
                                            asistencias_oficiales = :asistencias_oficiales,
                                            pases_intentados = :pases_intentados,
                                            pases_completados = :pases_completados,
                                            pases_clave = :pases_clave,
                                            regates_intentados = :regates_intentados,
                                            regates_exitosos = :regates_exitosos,
                                            recuperaciones = :recuperaciones,
                                            intercepciones = :intercepciones,
                                            entradas_exitosas = :entradas_exitosas,
                                            duelos_defensivos_totales = :duelos_defensivos_totales,
                                            duelos_defensivos_ganados = :duelos_defensivos_ganados,
                                            ocasiones_creadas = :ocasiones_creadas,
                                            goles_sin_penal = :goles_sin_penal,
                                            distinciones_individuales = :distinciones_individuales,
                                            balones_de_oro = :balones_de_oro,
                                            titulos_totales = :titulos_totales,
                                            goles_sin_penal_p90 = :goles_sin_penal_p90,
                                            goles_p90 = :goles_p90,
                                            conversion_goles = :conversion_goles,
                                            rating_ataque = :rating_ataque,
                                            asistencias_p90 = :asistencias_p90,
                                            pases_clave_p90 = :pases_clave_p90,
                                            ocasiones_creadas_p90 = :ocasiones_creadas_p90,
                                            rating_creacion = :rating_creacion,
                                            porcentaje_regates = :porcentaje_regates,
                                            precision_pases = :precision_pases,
                                            rating_tecnica = :rating_tecnica,
                                            porcentaje_duelos_defensivos = :porcentaje_duelos_defensivos,
                                            entradas_exitosas_p90 = :entradas_exitosas_p90,
                                            intercepciones_p90 = :intercepciones_p90,
                                            recuperaciones_p90 = :recuperaciones_p90,
                                            rating_defensa = :rating_defensa,
                                            duelos_ganados_p90 = :duelos_ganados_p90,
                                            rating_fisico = :rating_fisico,
                                            distinciones_norm = :distinciones_norm,
                                            balones_oro_norm = :balones_oro_norm,
                                            titulos_norm = :titulos_norm,
                                            rating_palmares = :rating_palmares,
                                            precio = :precio,
                                            rating_general = :rating_general,
                                            media_juego = :media_juego
                                        WHERE id = :pid
                                    """),
                                    {
                                        "pid": pid,
                                        "partidos_oficiales": int(row["partidos_oficiales"] or 0),
                                        "minutos_jugados": int(row["minutos_jugados"] or 0),
                                        "vallas_invictas": int(row["vallas_invictas"] or 0),
                                        "goles_oficiales": int(row["goles_oficiales"] or 0),
                                        "remates_totales": int(row["remates_totales"] or 0),
                                        "asistencias_oficiales": int(row["asistencias_oficiales"] or 0),
                                        "pases_intentados": int(row["pases_intentados"] or 0),
                                        "pases_completados": int(row["pases_completados"] or 0),
                                        "pases_clave": int(row["pases_clave"] or 0),
                                        "regates_intentados": int(row["regates_intentados"] or 0),
                                        "regates_exitosos": int(row["regates_exitosos"] or 0),
                                        "recuperaciones": int(row["recuperaciones"] or 0),
                                        "intercepciones": int(row["intercepciones"] or 0),
                                        "entradas_exitosas": int(row["entradas_exitosas"] or 0),
                                        "duelos_defensivos_totales": int(row["duelos_defensivos_totales"] or 0),
                                        "duelos_defensivos_ganados": int(row["duelos_defensivos_ganados"] or 0),
                                        "ocasiones_creadas": int(row["ocasiones_creadas"] or 0),
                                        "goles_sin_penal": int(row["goles_sin_penal"] or 0),
                                        "distinciones_individuales": int(row["distinciones_individuales"] or 0),
                                        "balones_de_oro": int(row["balones_de_oro"] or 0),
                                        "titulos_totales": int(row["titulos_totales"] or 0),
                                        "goles_sin_penal_p90": float(row["goles_sin_penal_p90"] or 0.0),
                                        "goles_p90": float(row["goles_p90"] or 0.0),
                                        "conversion_goles": float(row["conversion_goles"] or 0.0),
                                        "rating_ataque": int(row["rating_ataque"] or 0),
                                        "asistencias_p90": float(row["asistencias_p90"] or 0.0),
                                        "pases_clave_p90": float(row["pases_clave_p90"] or 0.0),
                                        "ocasiones_creadas_p90": float(row["ocasiones_creadas_p90"] or 0.0),
                                        "rating_creacion": int(row["rating_creacion"] or 0),
                                        "porcentaje_regates": float(row["porcentaje_regates"] or 0.0),
                                        "precision_pases": float(row["precision_pases"] or 0.0),
                                        "rating_tecnica": int(row["rating_tecnica"] or 0),
                                        "porcentaje_duelos_defensivos": float(row["porcentaje_duelos_defensivos"] or 0.0),
                                        "entradas_exitosas_p90": float(row["entradas_exitosas_p90"] or 0.0),
                                        "intercepciones_p90": float(row["intercepciones_p90"] or 0.0),
                                        "recuperaciones_p90": float(row["recuperaciones_p90"] or 0.0),
                                        "rating_defensa": int(row["rating_defensa"] or 0),
                                        "duelos_ganados_p90": float(row["duelos_ganados_p90"] or 0.0),
                                        "rating_fisico": int(row["rating_fisico"] or 0),
                                        "distinciones_norm": float(row["distinciones_norm"] or 0.0),
                                        "balones_oro_norm": float(row["balones_oro_norm"] or 0.0),
                                        "titulos_norm": float(row["titulos_norm"] or 0.0),
                                        "rating_palmares": int(row["rating_palmares"] or 0),
                                        "precio": float(row["precio"] or 0.0),
                                        "rating_general": int(row["rating_general"] or 0),
                                        "media_juego": int(row["media_juego"] or 0),
                                    },
                                )

        # 1. Asegurar nuevas columnas en 'users' sin borrar los usuarios ya registrados
        if "users" in existing_tables:
            user_cols = {c["name"] for c in insp.get_columns("users")}
            new_user_columns = [
                ("partidos_jugados", "INT NOT NULL DEFAULT 0"),
                ("victorias", "INT NOT NULL DEFAULT 0"),
                ("empates", "INT NOT NULL DEFAULT 0"),
                ("derrotas", "INT NOT NULL DEFAULT 0"),
                ("goles_favor", "INT NOT NULL DEFAULT 0"),
                ("goles_contra", "INT NOT NULL DEFAULT 0"),
                ("notif_activas", "BOOLEAN NOT NULL DEFAULT 1"),
                ("sonido_activo", "BOOLEAN NOT NULL DEFAULT 0"),
                ("auth_provider", "VARCHAR(20) NOT NULL DEFAULT 'local'"),
            ]
            with engine.begin() as conn:
                for col_name, col_def in new_user_columns:
                    if col_name not in user_cols:
                        conn.execute(text(f"ALTER TABLE users ADD COLUMN {col_name} {col_def}"))

        # 1.1 Asegurar columnas requeridas en 'plantillas' (es_activa, created_at, updated_at)
        if "plantillas" in existing_tables:
            plantilla_cols = {c["name"] for c in insp.get_columns("plantillas")}
            new_plantilla_columns = [
                ("es_activa", "BOOLEAN DEFAULT TRUE"),
                ("created_at", "DATETIME DEFAULT CURRENT_TIMESTAMP"),
                ("updated_at", "DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP"),
            ]
            with engine.begin() as conn:
                for col_name, col_def in new_plantilla_columns:
                    if col_name not in plantilla_cols:
                        conn.execute(text(f"ALTER TABLE plantillas ADD COLUMN {col_name} {col_def}"))

        # 1.2 Asegurar columnas en 'user_players' (energia, stats de club)
        if "user_players" in existing_tables:
            up_cols = {c["name"] for c in insp.get_columns("user_players")}
            new_up_columns = [
                ("energia", "TINYINT UNSIGNED NOT NULL DEFAULT 100"),
                ("partidos_club", "SMALLINT UNSIGNED NOT NULL DEFAULT 0"),
                ("goles_club", "SMALLINT UNSIGNED NOT NULL DEFAULT 0"),
                ("vallas_invictas_club", "SMALLINT UNSIGNED NOT NULL DEFAULT 0"),
                ("mvps_club", "SMALLINT UNSIGNED NOT NULL DEFAULT 0"),
                ("rating_promedio", "DECIMAL(4,2) NOT NULL DEFAULT 0.00"),
                ("adquirido_en", "TIMESTAMP DEFAULT CURRENT_TIMESTAMP"),
            ]
            with engine.begin() as conn:
                for col_name, col_def in new_up_columns:
                    if col_name not in up_cols:
                        conn.execute(text(f"ALTER TABLE user_players ADD COLUMN {col_name} {col_def}"))

        # 1.3 Asegurar columnas en 'partidos' (MVP y estadísticas completas)
        if "partidos" in existing_tables:
            p_cols = {c["name"] for c in insp.get_columns("partidos")}
            new_p_columns = [
                ("mvp_nombre", "VARCHAR(120) NULL"),
                ("mvp_rol", "VARCHAR(10) NULL"),
                ("mvp_rating", "FLOAT NULL"),
                ("mvp_equipo", "VARCHAR(15) NULL DEFAULT 'local'"),
                ("posesion_local", "INT NOT NULL DEFAULT 50"),
                ("posesion_visitante", "INT NOT NULL DEFAULT 50"),
                ("tiros_local", "INT NOT NULL DEFAULT 0"),
                ("tiros_visitante", "INT NOT NULL DEFAULT 0"),
                ("atajadas_local", "INT NOT NULL DEFAULT 0"),
                ("atajadas_visitante", "INT NOT NULL DEFAULT 0"),
                ("amarillas_local", "INT NOT NULL DEFAULT 0"),
                ("amarillas_visitante", "INT NOT NULL DEFAULT 0"),
                ("rojas_local", "INT NOT NULL DEFAULT 0"),
                ("rojas_visitante", "INT NOT NULL DEFAULT 0"),
                ("seed_simulacion", "INT NULL"),
            ]
            with engine.begin() as conn:
                for col_name, col_def in new_p_columns:
                    if col_name not in p_cols:
                        conn.execute(text(f"ALTER TABLE partidos ADD COLUMN {col_name} {col_def}"))

        # 1.4 En MySQL / TiDB asegurar AUTO_ID_CACHE = 1 en todas las tablas con AUTO_INCREMENT
        # para forzar IDs estrictamente secuenciales (1, 2, 3...) y evitar los saltos en bloques de 4000 de TiDB
        if engine.dialect.name == "mysql":
            tidb_tables = [
                "users",
                "players",
                "user_players",
                "plantillas",
                "plantilla_jugadores",
                "partidos",
                "eventos_partido",
            ]
            with engine.begin() as conn:
                for t_name in tidb_tables:
                    if t_name in existing_tables:
                        try:
                            conn.execute(text(f"ALTER TABLE {t_name} AUTO_ID_CACHE = 1"))
                        except Exception as tidb_err:
                            logger.debug(f"Aviso al configurar AUTO_ID_CACHE en {t_name}: {tidb_err}")

    except Exception as mig_err:
        logger.warning(f"Aviso durante verificación de esquema optimizado: {mig_err}")


def seed_database_if_needed():
    """Crea las 7 tablas optimizadas y siembra las 80 leyendas históricas desde players_seed.csv si la base está vacía."""
    from app.models.player import Player
    from app.models.user import User  # noqa: F401
    from app.models.squad import UserPlayer, Plantilla, PlantillaJugador  # noqa: F401
    from app.models.match import Partido, EventoPartido  # noqa: F401
    try:
        _ensure_optimized_schema()
        Base.metadata.create_all(bind=engine)
        db = SessionLocal()
        try:
            total_players = db.query(Player).count()
            if total_players == 0:
                csv_path = os.path.abspath(
                    os.path.join(os.path.dirname(__file__), "..", "seed", "players_seed.csv")
                )
                if os.path.exists(csv_path):
                    with open(csv_path, mode="r", encoding="utf-8") as f:
                        reader = csv.DictReader(f)
                        players_to_add = []
                        for row in reader:
                            p = Player(
                                id=int(row["id"]),
                                nombre=row["nombre"],
                                posicion_base=row["posicion_base"],
                                posicion_detalle=row["posicion_detalle"],
                                nacionalidad=row["nacionalidad"],
                                partidos_oficiales=int(row["partidos_oficiales"] or 0),
                                minutos_jugados=int(row["minutos_jugados"] or 0),
                                vallas_invictas=int(row["vallas_invictas"] or 0),
                                goles_oficiales=int(row["goles_oficiales"] or 0),
                                remates_totales=int(row["remates_totales"] or 0),
                                asistencias_oficiales=int(row["asistencias_oficiales"] or 0),
                                pases_intentados=int(row["pases_intentados"] or 0),
                                pases_completados=int(row["pases_completados"] or 0),
                                pases_clave=int(row["pases_clave"] or 0),
                                regates_intentados=int(row["regates_intentados"] or 0),
                                regates_exitosos=int(row["regates_exitosos"] or 0),
                                recuperaciones=int(row["recuperaciones"] or 0),
                                intercepciones=int(row["intercepciones"] or 0),
                                entradas_exitosas=int(row["entradas_exitosas"] or 0),
                                duelos_defensivos_totales=int(row["duelos_defensivos_totales"] or 0),
                                duelos_defensivos_ganados=int(row["duelos_defensivos_ganados"] or 0),
                                ocasiones_creadas=int(row["ocasiones_creadas"] or 0),
                                goles_sin_penal=int(row["goles_sin_penal"] or 0),
                                distinciones_individuales=int(row["distinciones_individuales"] or 0),
                                balones_de_oro=int(row["balones_de_oro"] or 0),
                                titulos_totales=int(row["titulos_totales"] or 0),
                                goles_sin_penal_p90=float(row["goles_sin_penal_p90"] or 0.0),
                                goles_p90=float(row["goles_p90"] or 0.0),
                                conversion_goles=float(row["conversion_goles"] or 0.0),
                                rating_ataque=int(row["rating_ataque"] or 0),
                                asistencias_p90=float(row["asistencias_p90"] or 0.0),
                                pases_clave_p90=float(row["pases_clave_p90"] or 0.0),
                                ocasiones_creadas_p90=float(row["ocasiones_creadas_p90"] or 0.0),
                                rating_creacion=int(row["rating_creacion"] or 0),
                                porcentaje_regates=float(row["porcentaje_regates"] or 0.0),
                                precision_pases=float(row["precision_pases"] or 0.0),
                                rating_tecnica=int(row["rating_tecnica"] or 0),
                                porcentaje_duelos_defensivos=float(row["porcentaje_duelos_defensivos"] or 0.0),
                                entradas_exitosas_p90=float(row["entradas_exitosas_p90"] or 0.0),
                                intercepciones_p90=float(row["intercepciones_p90"] or 0.0),
                                recuperaciones_p90=float(row["recuperaciones_p90"] or 0.0),
                                rating_defensa=int(row["rating_defensa"] or 0),
                                duelos_ganados_p90=float(row["duelos_ganados_p90"] or 0.0),
                                rating_fisico=int(row["rating_fisico"] or 0),
                                distinciones_norm=float(row["distinciones_norm"] or 0.0),
                                balones_oro_norm=float(row["balones_oro_norm"] or 0.0),
                                titulos_norm=float(row["titulos_norm"] or 0.0),
                                rating_palmares=int(row["rating_palmares"] or 0),
                                precio=float(row["precio"] or 0.0),
                                rating_general=int(row["rating_general"] or 0),
                                media_juego=int(row["media_juego"] or 0),
                            )
                            players_to_add.append(p)
                        db.add_all(players_to_add)
                        db.commit()
                        logger.info(f"Base de datos sembrada con {len(players_to_add)} leyendas exitosamente.")

            # Actualizar presupuesto disponible de los mánagers al nuevo tope oficial de 150.0M
            users_all = db.query(User).all()
            budget_updated = False
            for u in users_all:
                pl = (
                    db.query(Plantilla)
                    .filter(Plantilla.user_id == u.id, Plantilla.es_activa == True)  # noqa: E712
                    .order_by(Plantilla.id.desc())
                    .first()
                )
                spent = float(pl.costo_total or 0.0) if pl else 0.0
                expected_available = round(max(0.0, 150.0 - spent), 2)
                if abs(float(u.presupuesto or 0.0) - expected_available) > 0.01:
                    u.presupuesto = expected_available
                    budget_updated = True
            if budget_updated:
                db.commit()
        finally:
            db.close()
    except Exception as e:
        logger.error(f"Error al sembrar base de datos: {e}")


# Ejecutar siembra inicial si es necesario
seed_database_if_needed()


def get_db() -> Generator[Session, None, None]:
    """Generador de sesiones de base de datos para inyección de dependencias en FastAPI.
    Asegura que la sesión se cierre adecuadamente al finalizar el ciclo de vida del request.
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
