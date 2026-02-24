<?php
/**
 * CORS Headers Configuration
 */

// Allow from localhost during development and your production domain
$allowed_origins = [
    'http://localhost:5173',
    'http://localhost:3000',
    'https://yourdomain.com' // Update with your production domain (e.g., Vercel, Netlify, etc.)
];

$origin = $_SERVER['HTTP_ORIGIN'] ?? '';

if (in_array($origin, $allowed_origins)) {
    header("Access-Control-Allow-Origin: $origin");
} else {
    // Allow all origins in development (remove in production)
    header("Access-Control-Allow-Origin: *");
}

header("Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With");
header("Access-Control-Allow-Credentials: true");
header("Content-Type: application/json; charset=UTF-8");

// Handle preflight requests
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}
