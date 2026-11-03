import os
import csv
import logging
from typing import Generator
from sqlalchemy import create_engine, text
from sqlalchemy.orm import declarative_base, sessionmaker, Session
from app.core.config import settings

logger = logging.getLogger("app.database")

Base = declarative_base()


def create_db_engine():
    """Intenta conectar a MySQL según settings.DATABASE_URL.
    Si MySQL no responde o falla, realiza un fallback automático e inteligente
    a SQLite local (fantasy_leyendas.db) para permitir el desarrollo continuo y
    la ejecución sin depender de que XAMPP o MySQL estén activos.
    """
    mysql_url = settings.DATABASE_URL
    try:
        connect_args = {"connect_timeout": 2} if "mysql" in mysql_url else {}
        eng = create_engine(
            mysql_url,
            pool_pre_ping=True,
            pool_recycle=3600,
            connect_args=connect_args
        )
        with eng.connect() as conn:
            conn.execute(text("SELECT 1"))
        logger.info(f"Conexión exitosa a MySQL: {mysql_url}")
        return eng
    except Exception as e:
        logger.warning(
            f"No se pudo conectar a MySQL en localhost ({e}). "
            "Activando fallback automático a SQLite local."
        )
        sqlite_file = os.path.abspath(
            os.path.join(os.path.dirname(__file__), "..", "..", "fantasy_leyendas.db")
        )
        sqlite_url = f"sqlite:///{sqlite_file}"
        eng = create_engine(sqlite_url, connect_args={"check_same_thread": False})
        return eng


engine = create_db_engine()
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def seed_database_if_needed():
    """Crea las tablas y siembra las 80 leyendas históricas desde players_seed.csv si la base está vacía."""
    from app.models.player import Player
    try:
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
