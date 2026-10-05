.PHONY: up down reset test

up: ## Build and start MongoDB, the API (:3000, docs at /docs) and the client (:5173)
	docker compose up --build

down: ## Stop everything (data is kept)
	docker compose down

reset: ## Stop everything and delete the database
	docker compose down -v

test: ## Run backend and client unit tests, then the browser test
	npm test
	npm --prefix client test
	npm --prefix client run e2e
