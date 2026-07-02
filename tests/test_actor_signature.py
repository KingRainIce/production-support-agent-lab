import json

import pytest

from support_agent_lab.api.auth import _get_production_actor
from support_agent_lab.scripts.sign_actor_headers import main as sign_headers_main
from support_agent_lab.security.actor_signature import (
    build_actor_headers,
    canonical_actor_claims,
    sign_actor_claims,
)


ACTOR_SIGNATURE_SECRET = "actor-signing-secret-with-32-byte-minimum"


def test_shared_actor_header_builder_authenticates_production_actor():
    headers = build_actor_headers(
        internal_api_key="internal-key",
        signature_secret=ACTOR_SIGNATURE_SECRET,
        tenant_id="tenant_live",
        user_id="user_prod",
        roles=["admin", " user "],
        scopes=["monitor:read", " audit:read "],
        timestamp="1783014000",
    )

    actor = _get_production_actor(
        expected_key="internal-key",
        provided_key=headers["X-Internal-Auth"],
        user_id=headers["X-Actor-User-Id"],
        roles_header=headers["X-Actor-Roles"],
        scopes_header=headers["X-Actor-Scopes"],
        actor_signature_secret=ACTOR_SIGNATURE_SECRET,
        actor_signature_timestamp=headers["X-Actor-Timestamp"],
        actor_signature=headers["X-Actor-Signature"],
        actor_signature_max_age_seconds=999999999,
        tenant_id="tenant_live",
    )

    assert actor.user_id == "user_prod"
    assert actor.roles == ["admin", "user"]
    assert actor.scopes == ["monitor:read", "audit:read"]


def test_actor_signature_canonicalizes_csv_and_sequence_inputs():
    first = sign_actor_claims(
        secret=ACTOR_SIGNATURE_SECRET,
        tenant_id="tenant_live",
        user_id="user_prod",
        roles_header=" admin, user ",
        scopes_header=" monitor:read, audit:read ",
        timestamp="1783014000",
    )
    second = sign_actor_claims(
        secret=ACTOR_SIGNATURE_SECRET,
        tenant_id="tenant_live",
        user_id="user_prod",
        roles_header=["admin", "user"],
        scopes_header=["monitor:read", "audit:read"],
        timestamp="1783014000",
    )

    assert first == second
    assert (
        canonical_actor_claims(
            tenant_id="tenant_live",
            user_id="user_prod",
            roles_header=" admin, user ",
            scopes_header=" monitor:read, audit:read ",
            timestamp="1783014000",
        )
        == "v1\ntenant_live\nuser_prod\nadmin,user\nmonitor:read,audit:read\n1783014000"
    )
    assert (
        canonical_actor_claims(
            tenant_id="tenant_live",
            user_id="user_prod",
            roles_header=None,
            scopes_header=" crm:read ",
            timestamp="1783014000",
        )
        == "v1\ntenant_live\nuser_prod\nuser\ncrm:read\n1783014000"
    )


def test_sign_actor_headers_cli_outputs_json(capsys):
    result = sign_headers_main(
        [
            "--tenant-id",
            "tenant_live",
            "--internal-api-key",
            "internal-key",
            "--signature-secret",
            ACTOR_SIGNATURE_SECRET,
            "--user-id",
            "user_prod",
            "--roles",
            "admin,user",
            "--scopes",
            "monitor:read,audit:read",
            "--timestamp",
            "1783014000",
            "--format",
            "json",
        ]
    )

    assert result == 0
    headers = json.loads(capsys.readouterr().out)
    assert headers["X-Internal-Auth"] == "internal-key"
    assert headers["X-Actor-Roles"] == "admin,user"
    assert headers["X-Actor-Signature"].startswith("sha256=")


def test_sign_actor_headers_cli_requires_gateway_secrets(monkeypatch):
    monkeypatch.delenv("APP_TENANT_ID", raising=False)
    monkeypatch.delenv("APP_INTERNAL_API_KEY", raising=False)
    monkeypatch.delenv("APP_ACTOR_SIGNATURE_SECRET", raising=False)

    with pytest.raises(SystemExit) as exc:
        sign_headers_main(
            [
                "--tenant-id",
                "tenant_live",
                "--user-id",
                "user_prod",
                "--scopes",
                "monitor:read",
            ]
        )

    assert exc.value.code == 2
