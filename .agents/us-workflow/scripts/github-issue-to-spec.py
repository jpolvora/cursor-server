#!/usr/bin/env python3
"""
Converts `gh issue view {n} --json ...` output into canonical `*.spec.md` (cursor-server).

Usage:
  gh issue view 1234 --json number,title,body,state,labels,assignees,comments,url \
    > .cursor/plans/us-1234/us-1234.issue.json
  python github-issue-to-spec.py \
    --input .cursor/plans/us-1234/us-1234.issue.json \
    --output .cursor/plans/us-1234/us-1234.spec.md

`--input` also accepts `-` for stdin (pipe from gh).
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from datetime import date
from pathlib import Path


def load_issue(raw: str) -> dict:
    data = json.loads(raw)
    if isinstance(data, list):  # `gh issue list --json` returns an array
        data = data[0] if data else {}
    return data or {}


_AC_HEADING = re.compile(
    r"^#{1,6}\s*(crit[eé]rios?\s+de\s+aceite|acceptance\s+criteria|ac[s]?)\b",
    re.IGNORECASE,
)


def split_body(body: str) -> tuple[str, list[str]]:
    """Return (description, acceptance-criteria items).

    Splits the issue body at the first Acceptance Criteria heading, if any.
    Bullet/numbered lines under that heading become AC items.
    """
    body = (body or "").replace("\r\n", "\n").strip()
    if not body:
        return "", []

    lines = body.split("\n")
    ac_start = None
    for idx, line in enumerate(lines):
        if _AC_HEADING.match(line.strip()):
            ac_start = idx
            break

    if ac_start is None:
        return body, []

    description = "\n".join(lines[:ac_start]).strip()
    ac_items: list[str] = []
    for line in lines[ac_start + 1:]:
        stripped = line.strip()
        if not stripped:
            continue
        if stripped.startswith("#"):  # next section ends the AC block
            break
        item = re.sub(r"^[-*+]\s+|^\d+[.)]\s+|^\[[ xX]\]\s+", "", stripped).strip()
        item = re.sub(r"^-?\s*\[[ xX]\]\s*", "", item).strip()
        if item:
            ac_items.append(item)
    return description, ac_items


def build_spec_md(issue: dict, repo: str | None) -> str:
    number = issue.get("number")
    slug = f"us-{number}" if number else "spec"
    title = (issue.get("title") or (f"US {number}" if number else "Especificação")).strip()
    state = (issue.get("state") or "").lower()
    url = issue.get("url") or (
        f"https://github.com/{repo}/issues/{number}" if repo and number else ""
    )
    labels = [l.get("name") for l in (issue.get("labels") or []) if l.get("name")]
    assignees = [a.get("login") for a in (issue.get("assignees") or []) if a.get("login")]

    description, ac_items = split_body(issue.get("body") or "")

    fm = [
        "---",
        f"id: {number if number else 'null'}",
        f"slug: {slug}",
        f'title: "{title.replace(chr(34), chr(39))}"',
        "source: github",
    ]
    if state:
        fm.append(f"issueState: {state}")
    if url:
        fm.append(f'issueUrl: "{url}"')
    if labels:
        fm.append(f"labels: [{', '.join(labels)}]")
    fm.append(f"specDate: {date.today().isoformat()}")
    fm.append("---")
    fm.append("")

    body: list[str] = [f"# Especificação — {title}", ""]
    meta = []
    if state:
        meta.append(f"**Estado:** {state}")
    if assignees:
        meta.append(f"**Atribuído:** {', '.join(assignees)}")
    if labels:
        meta.append(f"**Labels:** {', '.join(labels)}")
    if meta:
        body.extend(meta)
        body.append("")

    body.append("## Descrição")
    body.append("")
    body.append(description or "_Sem descrição na issue._")
    body.append("")

    body.append("## Critérios de Aceite")
    body.append("")
    if ac_items:
        for idx, ac in enumerate(ac_items, 1):
            body.append(f"- AC{idx}: {ac}")
    else:
        body.append("_Nenhum critério de aceite explícito na issue — extrair/validar no refinamento._")
    body.append("")

    comments = issue.get("comments") or []
    if comments:
        body.append("## Comentários (auditoria)")
        body.append("")
        for c in comments:
            author = (c.get("author") or {}).get("login") or "?"
            text = (c.get("body") or "").strip()
            if text:
                body.append(f"- **{author}:** {text}")
        body.append("")

    body.append("## Notas")
    body.append("")
    body.append("_Gerado automaticamente a partir do JSON de `gh issue view` (GitHub)._")
    body.append("")

    return "\n".join(fm + body)


def main() -> int:
    if sys.platform == "win32":
        sys.stdout.reconfigure(encoding="utf-8")

    parser = argparse.ArgumentParser(description="Converte JSON de gh issue view em *.spec.md canônico")
    parser.add_argument("--input", required=True, help="Caminho do JSON (gh issue view --json ...) ou '-' para stdin")
    parser.add_argument("--output", required=True, help="Caminho de saída *.spec.md")
    parser.add_argument("--repo", default="", help="owner/repo (para issueUrl quando ausente no JSON)")
    args = parser.parse_args()

    if args.input == "-":
        raw = sys.stdin.read()
    else:
        input_path = Path(args.input)
        if not input_path.is_file():
            print(f"Erro: arquivo de entrada não encontrado: {input_path}", file=sys.stderr)
            return 1
        raw = input_path.read_text(encoding="utf-8")

    try:
        issue = load_issue(raw)
    except json.JSONDecodeError as exc:
        print(f"Erro: JSON inválido — {exc}", file=sys.stderr)
        return 1

    spec_md = build_spec_md(issue, args.repo or None)

    output_path = Path(args.output)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(spec_md, encoding="utf-8")
    print(f"Spec gravado em: {output_path}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
