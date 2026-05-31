import sqlite3
import os

db_path = "backend/Prism.db"
if os.path.exists(db_path):
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    try:
        cursor.execute("ALTER TABLE photos ADD COLUMN hash VARCHAR(64)")
        cursor.execute("CREATE INDEX idx_photos_hash ON photos (hash)")
        print("Successfully added 'hash' column to photos table.")
    except sqlite3.OperationalError as e:
        if "duplicate column name" in str(e).lower():
            print("Column 'hash' already exists.")
        else:
            print(f"Error: {e}")
    conn.commit()
    conn.close()
else:
    print("Database file not found.")
