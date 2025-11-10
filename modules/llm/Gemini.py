from .BaseLLM import BaseLLM
import os
from typing import Dict, List


def _is_truthy(value: str) -> bool:
    return str(value).strip().lower() in {"1", "true", "yes", "y"}


class Gemini(BaseLLM):
    """
    Gemini wrapper supporting the OpenAI-compatible endpoint
    (https://generativelanguage.googleapis.com/v1beta/openai/) with dual-API
    key rotation. Falls back to google genai client if desired.

    Env/config support:
    - GEMINI_OPENAI_API_KEYS / GEMINI_API_KEYS: comma-separated keys for rotation
    - GEMINI_OPENAI_API_KEY / GEMINI_API_KEY / GOOGLE_API_KEY: single keys
    - GEMINI_API_KEY_2, GEMINI_API_KEY_3, ...: additional keys
    - GEMINI_OPENAI_BASE_URL: override OpenAI-compatible base (optional)
    - GEMINI_USE_OPENAI_COMPAT=1|true: force OpenAI-compatible mode
    """

    def __init__(self, model: str = "gemini-2.0-flash", use_openai_compat: bool = None):
        super(Gemini, self).__init__()
        self.model_name = model
        self.messages: List[Dict[str, str]] = []
        self._client = None
        self._client_pool = []
        self._client_mode = None  # "openai" or "google"
        self._client_index = 0
        self._use_openai_compat = use_openai_compat
        self._initialize_client()

    def _initialize_client(self):
        prefer_openai = self._use_openai_compat

        if prefer_openai is None:
            env_flag = os.getenv("GEMINI_USE_OPENAI_COMPAT", "")
            if env_flag:
                prefer_openai = _is_truthy(env_flag)
            else:
                # Default to OpenAI-compatible for broader compatibility
                prefer_openai = True

        if prefer_openai:
            from openai import OpenAI

            api_keys = self._collect_api_keys()
            if not api_keys:
                raise ValueError(
                    "Missing Gemini API key(s). Set GEMINI_API_KEY (and optionally GEMINI_API_KEY_2 / GEMINI_API_KEYS)."
                )
            # Prefer explicit OpenAI-compatible base; fallback to GEMINI_API_BASE if provided; else default
            base_url = (
                os.getenv("GEMINI_OPENAI_BASE_URL")
                or os.getenv("GEMINI_API_BASE")
                or "https://generativelanguage.googleapis.com/v1beta/openai/"
            )
            base_url = base_url.rstrip("/") + "/"

            self._client_pool = [OpenAI(api_key=key, base_url=base_url) for key in api_keys]
            self._client = self._client_pool[0]
            self.client = self._client
            self._client_mode = "openai"
        else:
            try:
                from google import genai
            except ImportError as exc:
                raise ImportError(
                    "google-generativeai is required to call Gemini directly. "
                    "Either install the package or set GEMINI_USE_OPENAI_COMPAT=1 to use the OpenAI-compatible endpoint."
                ) from exc

            api_key = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")
            if not api_key:
                raise ValueError("GEMINI_API_KEY or GOOGLE_API_KEY is required for the Gemini genai client.")

            self._client = genai.Client(api_key=api_key)
            self.client = self._client
            self._client_mode = "google"

    def _collect_api_keys(self):
        keys = []

        def _extend_from_env_list(var_name):
            value = os.getenv(var_name, "")
            if value:
                parts = [item.strip() for item in value.split(",") if item.strip()]
                keys.extend(parts)

        _extend_from_env_list("GEMINI_OPENAI_API_KEYS")
        _extend_from_env_list("GEMINI_API_KEYS")

        ordered_candidates = [
            os.getenv("GEMINI_OPENAI_API_KEY"),
            os.getenv("GEMINI_API_KEY"),
            os.getenv("GOOGLE_API_KEY"),
        ]
        keys.extend([val for val in ordered_candidates if val])

        idx = 2
        while True:
            alt = os.getenv(f"GEMINI_API_KEY_{idx}")
            if not alt:
                break
            keys.append(alt)
            idx += 1

        deduped = []
        seen = set()
        for key in keys:
            if key and key not in seen:
                deduped.append(key)
                seen.add(key)
        return deduped

    def _get_next_client(self):
        if not self._client_pool:
            return self._client
        client = self._client_pool[self._client_index]
        self._client_index = (self._client_index + 1) % len(self._client_pool)
        return client

    def initialize_message(self):
        self.messages = []

    def ai_message(self, payload):
        self.messages.append({"role": "ai", "content": payload})

    def system_message(self, payload):
        self.messages.append({"role": "system", "content": payload})

    def user_message(self, payload):
        self.messages.append({"role": "user", "content": payload})

    def _render_openai_messages(self):
        rendered = []
        for message in self.messages:
            role = message.get("role", "user")
            if role == "ai":
                role = "assistant"
            rendered.append({"role": role, "content": message.get("content", "")})
        return rendered

    def _render_google_messages(self):
        contents = []
        for message in self.messages:
            role = message.get("role", "user")
            text = message.get("content", "")
            if role == "system":
                contents.append({"role": "user", "parts": [{"text": f"System: {text}"}]})
                continue
            mapped_role = "model" if role in {"ai", "assistant"} else "user"
            contents.append({"role": mapped_role, "parts": [{"text": text}]})
        return contents

    def get_response(self, temperature=0.8, **kwargs):
        if self._client_mode == "openai":
            client = self._get_next_client()
            completion = client.chat.completions.create(
                model=self.model_name,
                messages=self._render_openai_messages(),
                temperature=temperature,
                **kwargs,
            )
            content = getattr(completion.choices[0].message, "content", None)
            if content is None:
                # Fallback to string conversion to avoid None propagation
                try:
                    return str(completion.choices[0].message)
                except Exception:
                    return ""
            return content

        # google genai flow
        from google import genai  # type: ignore  # lazy import to avoid hard dep if unused
        contents = self._render_google_messages()
        response = self._client.models.generate_content(
            model=self.model_name,
            contents=contents,
            config={"temperature": temperature},
            **kwargs,
        )
        text = getattr(response, "text", None)
        if text is None:
            try:
                return str(response)
            except Exception:
                return ""
        return text

    def chat(self, text, temperature=0.8):
        self.initialize_message()
        self.user_message(text)
        response = self.get_response(temperature=temperature)
        return response

    def print_prompt(self):
        for message in self.messages:
            print(message)
