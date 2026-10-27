import os
import pandas as pd
from sqlalchemy import create_engine, text

# =============================================================================
# CONFIGURACIÓN DE CONEXIÓN A MYSQL (XAMPP)
# =============================================================================
DB_USER = "root"
DB_PASS = ""          # Contraseña vacía por defecto en XAMPP
DB_HOST = "127.0.0.1" # Conexión IPv4 directa
DB_PORT = "3306"
DB_NAME = "fantasy_leyendas"

DATABASE_URL = f"mysql+pymysql://{DB_USER}:{DB_PASS}@{DB_HOST}:{DB_PORT}/{DB_NAME}?charset=utf8mb4"

def get_csv_path():
    """Busca el archivo players_seed.csv en posibles ubicaciones relativas."""
    base_dir = os.path.dirname(os.path.abspath(__file__))
    posibles_rutas = [
        os.path.join(base_dir, "players_seed.csv"),
        os.path.join(base_dir, "seed", "players_seed.csv"),
        os.path.join(os.getcwd(), "players_seed.csv"),
        os.path.join(os.getcwd(), "backend", "seed", "players_seed.csv"),
    ]
    for ruta in posibles_rutas:
        if os.path.exists(ruta):
            return ruta
    return None

def load_seed():
    csv_path = get_csv_path()
    if not csv_path:
        raise FileNotFoundError(
            "No se encontró el archivo 'players_seed.csv'. "
            "Asegúrate de colocarlo en la misma carpeta que este script o en backend/seed/"
        )

    print(f"-> Leyendo dataset desde: {csv_path}")
    df = pd.read_csv(csv_path)

    print(f"-> Conectando a la base de datos '{DB_NAME}' en MySQL...")
    engine = create_engine(DATABASE_URL)

    with engine.begin() as conn:
        # 1. Desactivar temporalmente revisión de FK y limpiar tabla
        print("-> Limpiando registros anteriores de la tabla 'players'...")
        conn.execute(text("SET FOREIGN_KEY_CHECKS = 0;"))
        conn.execute(text("TRUNCATE TABLE players;"))
        conn.execute(text("SET FOREIGN_KEY_CHECKS = 1;"))

        # 2. Insertar registros
        print(f"-> Insertando {len(df)} futbolistas de leyenda...")
        df.to_sql(name="players", con=conn, if_exists="append", index=False)

    print("¡Listo! Las 80 leyendas se cargaron correctamente en la base de datos.")

if __name__ == "__main__":
    try:
        load_seed()
    except Exception as e:
        print(f"\n[ERROR durante la carga]: {e}")