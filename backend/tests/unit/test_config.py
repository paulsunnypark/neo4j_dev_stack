from app.core.config import Settings


def test_cors_origins_list_parses_csv_values():
    settings = Settings(cors_origins="http://localhost:5173, http://127.0.0.1:5173")
    assert settings.cors_origins_list == [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ]


def test_cors_origins_list_has_local_default_when_empty():
    settings = Settings(cors_origins="")
    assert settings.cors_origins_list == ["http://localhost:5173"]
