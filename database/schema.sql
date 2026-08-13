CREATE TABLE IF NOT EXISTS schema_migrations (
  version INT PRIMARY KEY,
  applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS admin_users (
  id CHAR(36) PRIMARY KEY,
  username VARCHAR(80) NOT NULL UNIQUE,
  role ENUM('admin','viewer') NOT NULL DEFAULT 'admin',
  password_salt VARCHAR(128) NOT NULL,
  password_hash VARCHAR(256) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS drivers (
  id CHAR(36) PRIMARY KEY,
  display_name VARCHAR(80) NOT NULL,
  steam_id VARCHAR(20) NULL UNIQUE,
  status ENUM('pending','approved','blocked') NOT NULL DEFAULT 'pending',
  registered_at DATETIME(3) NOT NULL,
  last_login_at DATETIME(3) NULL,
  INDEX idx_drivers_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS client_sessions (
  token_hash CHAR(64) PRIMARY KEY,
  driver_id CHAR(36) NOT NULL,
  steam_id VARCHAR(20) NOT NULL,
  display_name VARCHAR(80) NOT NULL,
  role VARCHAR(30) NOT NULL DEFAULT 'driver',
  expires_at DATETIME(3) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_client_sessions_expiry (expires_at),
  CONSTRAINT fk_client_sessions_driver FOREIGN KEY (driver_id) REFERENCES drivers(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS server_profiles (
  game ENUM('ets2','ats') PRIMARY KEY,
  config_json JSON NOT NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS dispatcher_jobs (
  id CHAR(36) PRIMARY KEY,
  driver_id CHAR(36) NOT NULL,
  game ENUM('ets2','ats') NOT NULL,
  map_profile VARCHAR(40) NOT NULL,
  source_city VARCHAR(100) NOT NULL,
  source_company VARCHAR(100) NOT NULL,
  destination_city VARCHAR(100) NOT NULL,
  destination_company VARCHAR(100) NOT NULL,
  cargo VARCHAR(120) NOT NULL,
  trailer_mode ENUM('provided','owned') NOT NULL,
  payload_json JSON NOT NULL,
  status ENUM('reserved','applied','active','completed','cancelled','failed') NOT NULL DEFAULT 'reserved',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_dispatcher_driver (driver_id, created_at),
  CONSTRAINT fk_dispatcher_driver FOREIGN KEY (driver_id) REFERENCES drivers(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS telemetry_current (
  game ENUM('ets2','ats') NOT NULL,
  driver_key VARCHAR(80) NOT NULL,
  driver_id CHAR(36) NULL,
  payload_json JSON NOT NULL,
  updated_at DATETIME(3) NOT NULL,
  PRIMARY KEY (game, driver_key),
  INDEX idx_telemetry_updated (updated_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS convoys (
  id CHAR(36) PRIMARY KEY,
  game ENUM('ets2','ats') NOT NULL,
  title VARCHAR(160) NOT NULL,
  starts_at DATETIME(3) NULL,
  payload_json JSON NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS client_versions (
  version VARCHAR(30) PRIMARY KEY,
  channel VARCHAR(30) NOT NULL DEFAULT 'stable',
  download_url VARCHAR(500) NOT NULL,
  sha256 CHAR(64) NOT NULL,
  minimum_game_versions_json JSON NULL,
  published_at DATETIME(3) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS audit_events (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  actor VARCHAR(100) NOT NULL,
  action VARCHAR(100) NOT NULL,
  detail VARCHAR(500) NOT NULL DEFAULT '',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_audit_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO schema_migrations(version) VALUES (1);
