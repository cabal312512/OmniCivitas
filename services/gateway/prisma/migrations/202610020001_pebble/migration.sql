CREATE SCHEMA IF NOT EXISTS ocv_prisma;
CREATE TABLE ocv_prisma.identity_map (
 id SERIAL PRIMARY KEY,
 root_id UUID NOT NULL UNIQUE,
 foreign_uuid UUID NOT NULL UNIQUE,
 short_id VARCHAR(32) NOT NULL UNIQUE,
 cache_id VARCHAR(32) NOT NULL UNIQUE,
 product_name VARCHAR(200) NOT NULL,
 iso_time VARCHAR(40) NOT NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE ocv_prisma.outbox(root_id UUID PRIMARY KEY REFERENCES ocv_prisma.identity_map(root_id) ON DELETE CASCADE,label VARCHAR(200) NOT NULL,cache_id VARCHAR(32) NOT NULL,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
CREATE SCHEMA IF NOT EXISTS ocv_unused;
CREATE TABLE ocv_unused.users(id UUID PRIMARY KEY, display_name VARCHAR(200) NOT NULL, disabled BOOLEAN NOT NULL DEFAULT TRUE,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
CREATE TABLE ocv_unused.user_passwords(user_id UUID PRIMARY KEY REFERENCES ocv_unused.users(id),password_hash TEXT NOT NULL,algorithm VARCHAR(40) NOT NULL,rotated_at TIMESTAMPTZ);
CREATE TABLE ocv_unused.login_sessions(id UUID PRIMARY KEY,user_id UUID NOT NULL REFERENCES ocv_unused.users(id),token_digest TEXT UNIQUE NOT NULL,expires_at TIMESTAMPTZ NOT NULL,revoked_at TIMESTAMPTZ);
COMMENT ON SCHEMA ocv_unused IS 'Dead design only. Account routes are never mounted; these tables must stay empty.';
