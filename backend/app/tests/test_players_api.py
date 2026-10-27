import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.main import app
from app.core.database import Base, get_db
from app.models.player import Player

# SQLite en memoria para pruebas aisladas
SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


@pytest.fixture(scope="session", autouse=True)
def setup_test_db():
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()
    # Insertar datos de prueba
    p1 = Player(
        id=1,
        nombre="Diego Maradona",
        posicion_base="MC",
        posicion_detalle="Enganche",
        nacionalidad="Argentina",
        precio=25.0,
        media_juego=98,
        rating_general=98,
    )
    p2 = Player(
        id=2,
        nombre="Franz Beckenbauer",
        posicion_base="DEF",
        posicion_detalle="Líbero",
        nacionalidad="Alemania",
        precio=18.5,
        media_juego=95,
        rating_general=95,
    )
    p3 = Player(
        id=3,
        nombre="Lev Yashin",
        posicion_base="POR",
        posicion_detalle="Arquero",
        nacionalidad="Rusia",
        precio=12.0,
        media_juego=94,
        rating_general=94,
    )
    db.add_all([p1, p2, p3])
    db.commit()
    db.close()
    yield
    Base.metadata.drop_all(bind=engine)


def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


app.dependency_overrides[get_db] = override_get_db
client = TestClient(app)


def test_health_check():
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_list_players_all():
    response = client.get("/api/players")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 3


def test_filter_by_position():
    response = client.get("/api/players?posicion_base=MC")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["nombre"] == "Diego Maradona"


def test_filter_by_search_case_insensitive():
    response = client.get("/api/players?search=maradona")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["id"] == 1


def test_filter_by_max_precio():
    response = client.get("/api/players?max_precio=15.0")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["nombre"] == "Lev Yashin"


def test_filter_invalid_position_returns_400():
    response = client.get("/api/players?posicion_base=EXTREMO")
    assert response.status_code == 400


def test_get_player_by_id_success():
    response = client.get("/api/players/1")
    assert response.status_code == 200
    data = response.json()
    assert data["id"] == 1
    assert data["nombre"] == "Diego Maradona"


def test_get_player_by_id_not_found():
    response = client.get("/api/players/999")
    assert response.status_code == 404
