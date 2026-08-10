import os
from typing import Any, Callable
from dotenv import load_dotenv
from supabase import create_client, Client

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")

if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
    raise RuntimeError("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set")

_client: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

def get_client() -> Client:
    global _client
    return _client

def reset_client() -> Client:
    global _client
    _client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    return _client

class _SupabaseProxy:
    def __getattr__(self, name: str) -> Any:
        return getattr(_client, name)

supabase: Client = _SupabaseProxy()  # type: ignore

def safe_execute(query_fn: Callable[[], Any], retries: int = 2) -> Any:
    for attempt in range(retries + 1):
        try:
            return query_fn()
        except Exception as err:
            err_msg = str(err)
            if ("ConnectionTerminated" in err_msg or "stream" in err_msg.lower() or "connection" in err_msg.lower()) and attempt < retries:
                print(f"[Supabase Client] Re-initializing client connection due to stream termination (attempt {attempt + 1})...")
                reset_client()
                continue
            raise