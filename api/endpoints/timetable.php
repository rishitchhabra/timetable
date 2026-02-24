<?php
/**
 * Timetable API Endpoint
 */

require_once __DIR__ . '/../config/cors.php';
require_once __DIR__ . '/../config/database.php';

$database = new Database();
$db = $database->connect();

$method = $_SERVER['REQUEST_METHOD'];

try {
    switch ($method) {
        case 'GET':
            // Get all timetable entries grouped by section
            $stmt = $db->query("SELECT section_id, day, period, subject_id, teacher_id FROM timetable_entries");
            $entries = $stmt->fetchAll();
            
            // Group by section_id -> day -> period
            $timetable = [];
            foreach ($entries as $entry) {
                $sectionId = $entry['section_id'];
                $day = $entry['day'];
                $period = $entry['period'];
                
                if (!isset($timetable[$sectionId])) {
                    $timetable[$sectionId] = [];
                }
                if (!isset($timetable[$sectionId][$day])) {
                    $timetable[$sectionId][$day] = [];
                }
                
                $timetable[$sectionId][$day][$period] = [
                    'subjectId' => $entry['subject_id'],
                    'teacherId' => $entry['teacher_id']
                ];
            }
            
            echo json_encode($timetable);
            break;
            
        case 'POST':
            // Save timetable entry (upsert)
            $data = json_decode(file_get_contents("php://input"), true);
            
            if (!isset($data['sectionId']) || !isset($data['day']) || !isset($data['period'])) {
                http_response_code(400);
                echo json_encode(['error' => 'Missing required fields: sectionId, day, period']);
                exit;
            }
            
            // Use INSERT ... ON CONFLICT for upsert (PostgreSQL)
            $stmt = $db->prepare("
                INSERT INTO timetable_entries (section_id, day, period, subject_id, teacher_id) 
                VALUES (:section_id, :day, :period, :subject_id, :teacher_id)
                ON CONFLICT (section_id, day, period) DO UPDATE SET
                    subject_id = EXCLUDED.subject_id,
                    teacher_id = EXCLUDED.teacher_id,
                    updated_at = CURRENT_TIMESTAMP
            ");
            $stmt->execute([
                ':section_id' => $data['sectionId'],
                ':day' => $data['day'],
                ':period' => $data['period'],
                ':subject_id' => $data['subjectId'] ?? null,
                ':teacher_id' => $data['teacherId'] ?? null
            ]);
            
            http_response_code(201);
            echo json_encode(['success' => true]);
            break;
            
        case 'PUT':
            // Bulk save timetable entries
            $data = json_decode(file_get_contents("php://input"), true);
            
            if (!isset($data['entries']) || !is_array($data['entries'])) {
                http_response_code(400);
                echo json_encode(['error' => 'Missing entries array']);
                exit;
            }
            
            $db->beginTransaction();
            
            $stmt = $db->prepare("
                INSERT INTO timetable_entries (section_id, day, period, subject_id, teacher_id) 
                VALUES (:section_id, :day, :period, :subject_id, :teacher_id)
                ON CONFLICT (section_id, day, period) DO UPDATE SET
                    subject_id = EXCLUDED.subject_id,
                    teacher_id = EXCLUDED.teacher_id,
                    updated_at = CURRENT_TIMESTAMP
            ");
            
            foreach ($data['entries'] as $entry) {
                $stmt->execute([
                    ':section_id' => $entry['sectionId'],
                    ':day' => $entry['day'],
                    ':period' => $entry['period'],
                    ':subject_id' => $entry['subjectId'] ?? null,
                    ':teacher_id' => $entry['teacherId'] ?? null
                ]);
            }
            
            $db->commit();
            
            echo json_encode(['success' => true]);
            break;
            
        case 'DELETE':
            // Delete timetable entry
            $sectionId = $_GET['sectionId'] ?? null;
            $day = $_GET['day'] ?? null;
            $period = $_GET['period'] ?? null;
            
            if (!$sectionId || !$day || !$period) {
                http_response_code(400);
                echo json_encode(['error' => 'Missing sectionId, day, or period']);
                exit;
            }
            
            $stmt = $db->prepare("DELETE FROM timetable_entries WHERE section_id = :section_id AND day = :day AND period = :period");
            $stmt->execute([
                ':section_id' => $sectionId,
                ':day' => $day,
                ':period' => $period
            ]);
            
            echo json_encode(['success' => true]);
            break;
            
        default:
            http_response_code(405);
            echo json_encode(['error' => 'Method not allowed']);
    }
} catch (PDOException $e) {
    if ($db->inTransaction()) {
        $db->rollBack();
    }
    http_response_code(500);
    echo json_encode(['error' => 'Database error: ' . $e->getMessage()]);
}
