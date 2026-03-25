PRAGMA defer_foreign_keys=TRUE;
CREATE TABLE hotesse_calendars (
      id TEXT PRIMARY KEY,
      month INTEGER NOT NULL,
      year INTEGER NOT NULL,
      title TEXT NOT NULL,
      created_at TEXT NOT NULL,
      is_archived INTEGER NOT NULL DEFAULT 0
    );
CREATE TABLE hotesse_privatisations (
      id TEXT PRIMARY KEY,
      calendar_id TEXT NOT NULL,
      name TEXT NOT NULL,
      people INTEGER,
      date TEXT NOT NULL,
      start TEXT,
      end TEXT,
      period TEXT NOT NULL,
      color TEXT NOT NULL,
      prise_par TEXT,
      comment TEXT,
      commentaire TEXT,
      FOREIGN KEY (calendar_id) REFERENCES hotesse_calendars(id)
    );
CREATE TABLE hotesse_hostess_options (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE
    );
CREATE TABLE hotesse_prise_par_options (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE
    );
CREATE TABLE hotesse_privatisations_hostesses (
      priv_id TEXT NOT NULL,
      hostess_name TEXT NOT NULL,
      PRIMARY KEY (priv_id, hostess_name),
      FOREIGN KEY (priv_id) REFERENCES hotesse_privatisations(id)
    );
CREATE TABLE hotesse_notif_contacts (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT,
      phone TEXT
    );
CREATE TABLE hotesse_settings (
      id TEXT PRIMARY KEY,
      notif_contacts_json TEXT NOT NULL DEFAULT '[]',
      custom_logo TEXT,
      updated_at TEXT NOT NULL
    );
DELETE FROM sqlite_sequence;
INSERT INTO "sqlite_sequence" VALUES('hotesse_hostess_options',0);
INSERT INTO "sqlite_sequence" VALUES('hotesse_prise_par_options',0);
