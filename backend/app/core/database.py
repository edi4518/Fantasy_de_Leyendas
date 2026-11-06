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
            ]
            with engine.begin() as conn:
                for col_name, col_def in new_user_columns:
                    if col_name not in user_cols:
                        conn.execute(text(f"ALTER TABLE users ADD COLUMN {col_name} {col_def}"))

        # 2. Si aún no existe 'user_players' o 'partidos' tiene el esquema viejo (sin 'local_user_id'),
        # recrear las tablas relacionales de plantillas y partidos para aplicar el nuevo modelo completo.
        needs_recreate = "user_players" not in existing_tables
        if not needs_recreate and "partidos" in existing_tables:
            partido_cols = {c["name"] for c in insp.get_columns("partidos")}
            if "local_user_id" not in partido_cols or "mvp_nombre" not in partido_cols:
                needs_recreate = True
        if not needs_recreate and "plantilla_jugadores" in existing_tables:
            pj_cols = {c["name"] for c in insp.get_columns("plantilla_jugadores")}
            if "user_player_id" not in pj_cols:
                needs_recreate = True

        if needs_recreate:
            with engine.begin() as conn:
                if engine.dialect.name == "mysql":
                    conn.execute(text("SET FOREIGN_KEY_CHECKS = 0"))
                for tbl in ["eventos_partido", "partidos", "plantilla_jugadores", "plantillas", "user_players"]:
                    if tbl in existing_tables:
                        conn.execute(text(f"DROP TABLE IF EXISTS {tbl}"))
                if engine.dialect.name == "mysql":
                    conn.execute(text("SET FOREIGN_KEY_CHECKS = 1"))

        # 3. TiDB Cloud: Normalizar IDs históricos si existen 30001 o 30002
        if engine.dialect.name == "mysql":
            with engine.begin() as conn:
                try:
                    conn.execute(text("SET FOREIGN_KEY_CHECKS = 0"))
                    conn.execute(text("UPDATE users SET id = 3 WHERE id = 30001"))
                    conn.execute(text("UPDATE users SET id = 4 WHERE id = 30002"))
                    conn.execute(text("UPDATE plantillas SET user_id = 3 WHERE user_id = 30001"))
                    conn.execute(text("UPDATE plantillas SET user_id = 4 WHERE user_id = 30002"))
                    conn.execute(text("UPDATE user_players SET user_id = 3 WHERE user_id = 30001"))
                    conn.execute(text("UPDATE user_players SET user_id = 4 WHERE user_id = 30002"))
                    conn.execute(text("UPDATE plantillas SET id = 2 WHERE id = 30001"))
                    conn.execute(text("UPDATE plantillas SET id = 3 WHERE id = 60001"))
                    conn.execute(text("UPDATE plantillas SET id = 4 WHERE id = 60002"))
                    conn.execute(text("UPDATE plantilla_jugadores SET plantilla_id = 2 WHERE plantilla_id = 30001"))
                    conn.execute(text("UPDATE plantilla_jugadores SET plantilla_id = 3 WHERE plantilla_id = 60001"))
                    conn.execute(text("UPDATE plantilla_jugadores SET plantilla_id = 4 WHERE plantilla_id = 60002"))
                    conn.execute(text("SET FOREIGN_KEY_CHECKS = 1"))
                except Exception as norm_err:
                    logger.debug(f"Aviso durante normalización de IDs TiDB: {norm_err}")
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
