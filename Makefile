.PHONY: all help install check test seed start docker-build docker-up docker-down clean

help:
	@echo "DataLabel Automation & Developer Tasks"
	@echo "SPManchester Private Limited (https://www.spmanchester.com)"
	@echo ""
	@echo "Usage:"
	@echo "  make check        Syntax check all JavaScript files"
	@echo "  make test         Execute end-to-end integration test suite"
	@echo "  make seed         Re-initialize local database with fixture data"
	@echo "  make start        Run the DataLabel server on default port (4000)"
	@echo "  make docker-build Build container image"
	@echo "  make docker-up    Launch container service with docker-compose"
	@echo "  make docker-down  Tear down container service"
	@echo "  make clean        Remove generated database and runtime temp files"

check:
	node --check backend/src/server.js
	node --check backend/src/app.js
	node --check backend/src/db.js
	node --check backend/src/seed.js
	node --check backend/src/seed-data.js
	node --check backend/src/ai/engine.js
	node --check tests/run-tests.js

test:
	node tests/run-tests.js

seed:
	node backend/src/seed.js

start:
	node backend/src/server.js

docker-build:
	docker compose build

docker-up:
	docker compose up -d

docker-down:
	docker compose down

clean:
	rm -f *.sqlite *.sqlite-journal
