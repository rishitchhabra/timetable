<?php
/**
 * Database Configuration for Supabase (PostgreSQL)
 * Get these values from your Supabase project settings:
 * Project Settings -> Database -> Connection String (Direct connection)
 */

// Option 1: Using individual connection parameters
define('DB_HOST', 'db.your-project-ref.supabase.co');  // Your Supabase host
define('DB_NAME', 'postgres');                           // Database name (usually 'postgres')
define('DB_USER', 'postgres');                           // Database user
define('DB_PASS', 'your-database-password');             // Your database password
define('DB_PORT', '5432');                               // PostgreSQL port

// Option 2: Alternatively, use the full connection string
// Uncomment and use this if you prefer:
// define('DB_CONNECTION_STRING', 'postgresql://postgres:[YOUR-PASSWORD]@db.your-project-ref.supabase.co:5432/postgres');

class Database {
    private $connection;
    
    public function connect() {
        $this->connection = null;
        
        try {
            // Using PostgreSQL (pgsql) for Supabase
            // sslmode=require is needed for Supabase connections
            $this->connection = new PDO(
                "pgsql:host=" . DB_HOST . ";port=" . DB_PORT . ";dbname=" . DB_NAME . ";sslmode=require",
                DB_USER,
                DB_PASS,
                [
                    PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                    PDO::ATTR_EMULATE_PREPARES => false
                ]
            );
        } catch(PDOException $e) {
            http_response_code(500);
            echo json_encode(['error' => 'Database connection failed: ' . $e->getMessage()]);
            exit;
        }
        
        return $this->connection;
    }
}
