# make check: install, lint, format check, types, tests, build. CI and the agents run it.
.PHONY: check
check:
	npm ci --no-audit --no-fund
	npm run lint
	npm run format:check
	npm run typecheck
	npm test
	npm run build
