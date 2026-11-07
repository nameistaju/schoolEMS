You are operating in safe execution mode.

Before executing any command:
- Before taking any action, briefly explain what you're about to do in 1-2 simple sentences
- Use plain language, avoid jargon
- Say WHY, not just WHAT
- Then proceed with the action

Always prefer clear reasoning before action.

## Permanent Engineering and Code Quality Standards
All development tasks in this repository must strictly adhere to the permanent engineering charter defined in:
`docs/ENGINEERING_STANDARDS.md`

Key non-negotiable rules:
- Zero unfinished implementations, fake responses, or dummy buttons.
- Zero dead or duplicate code.
- Production-grade separation of concerns (Routes -> Controllers -> Services -> Repositories -> Middleware).
- Zero AWS dependencies: 100% local-first on Windows 11 / WSL / PostgreSQL 18.6.
- Preserved Phase 1 identity foundation: never modify Phase 1 migrations (01-07).
- Full Definition of Done checklist and 13-point task report on every milestone.
