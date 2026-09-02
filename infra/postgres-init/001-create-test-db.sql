-- Separate database for integration tests so table create_all/drop_all
-- cycles never touch the dev database that Alembic manages.
CREATE DATABASE aivis_test;
