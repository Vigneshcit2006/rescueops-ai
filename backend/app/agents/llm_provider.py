"""ModelProvider abstraction.

Used ONLY for interpretation/explanation/reasoning text — never for the
underlying math (routing, capacity, scoring), which stays deterministic.
If ANTHROPIC_API_KEY is not set, a clearly-labelled local rule-based
fallback is used so the app runs fully offline.
"""
from __future__ import annotations

import json
import os
from typing import Optional

import httpx

ANTHROPIC_API_KEY = os.environ.get("ANTHROPIC_API_KEY", "").strip()
ANTHROPIC_MODEL = os.environ.get("ANTHROPIC_MODEL", "claude-sonnet-5")
ANTHROPIC_URL = "https://api.anthropic.com/v1/messages"


class ModelProvider:
    name = "base"

    def explain_decision(self, context: dict) -> dict:
        raise NotImplementedError

    def analyze_failure(self, context: dict) -> dict:
        raise NotImplementedError

    def interpret_goal(self, goal_text: str) -> dict:
        raise NotImplementedError


class LocalFallbackProvider(ModelProvider):
    """Deterministic, template-based reasoning used when no LLM API key is configured."""
    name = "local-fallback"

    def explain_decision(self, context: dict) -> dict:
        action = context.get("selected_action", "")
        alt_count = len(context.get("alternatives", []))
        reason = (
            f"Selected '{action}' because it produced the highest simulation decision "
            f"score among {alt_count} evaluated alternative(s), while respecting capacity "
            f"and route-safety constraints."
        )
        return {"reason": reason, "provider": self.name}

    def analyze_failure(self, context: dict) -> dict:
        broken = context.get("broken_assignments", [])
        reasons = ", ".join(sorted({b["reason"] for b in broken})) or "unknown cause"
        summary = f"Plan invalidated for {len(broken)} assignment(s): {reasons}. Triggering replanning."
        return {"summary": summary, "provider": self.name}

    def interpret_goal(self, goal_text: str) -> dict:
        return {
            "interpretation": f"Objective parsed: prioritize CRITICAL victims, respect capacity/route constraints, "
                               f"complete within deadline. ({goal_text})",
            "provider": self.name,
        }


class AnthropicProvider(ModelProvider):
    name = "anthropic"

    def __init__(self, api_key: str, model: str):
        self.api_key = api_key
        self.model = model
        self._fallback = LocalFallbackProvider()

    def _call(self, system: str, user: str) -> Optional[dict]:
        try:
            resp = httpx.post(
                ANTHROPIC_URL,
                headers={
                    "x-api-key": self.api_key,
                    "anthropic-version": "2023-06-01",
                    "content-type": "application/json",
                },
                json={
                    "model": self.model,
                    "max_tokens": 300,
                    "system": system,
                    "messages": [{"role": "user", "content": user}],
                },
                timeout=8.0,
            )
            resp.raise_for_status()
            data = resp.json()
            text = "".join(b.get("text", "") for b in data.get("content", []) if b.get("type") == "text")
            return json.loads(text)
        except Exception:
            return None  # caller falls back to deterministic text

    def explain_decision(self, context: dict) -> dict:
        result = self._call(
            "You explain emergency-response simulation decisions in 1-2 concise sentences. "
            "Respond with strict JSON: {\"reason\": string}",
            json.dumps(context),
        )
        if result and "reason" in result:
            result["provider"] = self.name
            return result
        return self._fallback.explain_decision(context)

    def analyze_failure(self, context: dict) -> dict:
        result = self._call(
            "You summarize why a simulated mission plan failed, in 1-2 concise sentences. "
            "Respond with strict JSON: {\"summary\": string}",
            json.dumps(context),
        )
        if result and "summary" in result:
            result["provider"] = self.name
            return result
        return self._fallback.analyze_failure(context)

    def interpret_goal(self, goal_text: str) -> dict:
        result = self._call(
            "You restate an emergency-response mission goal concisely for an operator. "
            "Respond with strict JSON: {\"interpretation\": string}",
            goal_text,
        )
        if result and "interpretation" in result:
            result["provider"] = self.name
            return result
        return self._fallback.interpret_goal(goal_text)


def get_model_provider() -> ModelProvider:
    if ANTHROPIC_API_KEY:
        return AnthropicProvider(ANTHROPIC_API_KEY, ANTHROPIC_MODEL)
    return LocalFallbackProvider()
