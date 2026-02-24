<?php
/**
 * Section Subjects API Endpoint
 * Add/Remove subjects from sections
 */

require_once __DIR__ . '/../config/cors.php';
require_once __DIR__ . '/../config/database.php';

$database = new Database();
$db = $database->connect();

$method = $_SERVER['REQUEST_METHOD'];

try {
    switch ($method) {
        case 'POST':
            // Add subject to section
            $data = json_decode(file_get_contents("php://input"), true);
            
            if (!isset($data['sectionId']) || !isset($data['subjectId'])) {
                http_response_code(400);
                echo json_encode(['error' => 'Missing required fields: sectionId, subjectId']);
                exit;
            }
            
            $stmt = $db->prepare("INSERT INTO section_subjects (section_id, subject_id) VALUES (:section_id, :subject_id) ON CONFLICT (section_id, subject_id) DO NOTHING");
            $stmt->execute([
                ':section_id' => $data['sectionId'],
                ':subject_id' => $data['subjectId']
            ]);
            
            http_response_code(201);
            echo json_encode(['success' => true]);
            break;
            
        case 'DELETE':
            // Remove subject from section
            $sectionId = $_GET['sectionId'] ?? null;
            $subjectId = $_GET['subjectId'] ?? null;
            
            if (!$sectionId || !$subjectId) {
                http_response_code(400);
                echo json_encode(['error' => 'Missing sectionId or subjectId']);
                exit;
            }
            
            $stmt = $db->prepare("DELETE FROM section_subjects WHERE section_id = :section_id AND subject_id = :subject_id");
            $stmt->execute([
                ':section_id' => $sectionId,
                ':subject_id' => $subjectId
            ]);
            
            echo json_encode(['success' => true]);
            break;
            
        default:
            http_response_code(405);
            echo json_encode(['error' => 'Method not allowed']);
    }
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['error' => 'Database error: ' . $e->getMessage()]);
}
