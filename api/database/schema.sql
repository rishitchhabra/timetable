-- Timetable Database Schema for PostgreSQL/Supabase
-- Run this SQL in Supabase SQL Editor to create the required tables

-- Drop tables if they exist (in reverse order of dependencies)
DROP TABLE IF EXISTS timetable_entries CASCADE;
DROP TABLE IF EXISTS section_subjects CASCADE;
DROP TABLE IF EXISTS teacher_subjects CASCADE;
DROP TABLE IF EXISTS sections CASCADE;
DROP TABLE IF EXISTS classes CASCADE;
DROP TABLE IF EXISTS teachers CASCADE;
DROP TABLE IF EXISTS subjects CASCADE;

-- Subjects table
CREATE TABLE subjects (
    id VARCHAR(36) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    color VARCHAR(50) DEFAULT 'slate',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Teachers table
CREATE TABLE teachers (
    id VARCHAR(36) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    lowest_class INT DEFAULT 1,
    highest_class INT DEFAULT 12,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Teacher subjects (many-to-many relationship)
CREATE TABLE teacher_subjects (
    id SERIAL PRIMARY KEY,
    teacher_id VARCHAR(36) NOT NULL,
    subject_name VARCHAR(100) NOT NULL,
    FOREIGN KEY (teacher_id) REFERENCES teachers(id) ON DELETE CASCADE,
    CONSTRAINT unique_teacher_subject UNIQUE (teacher_id, subject_name)
);

-- Classes table
CREATE TABLE classes (
    id VARCHAR(36) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Sections table
CREATE TABLE sections (
    id VARCHAR(36) PRIMARY KEY,
    class_id VARCHAR(36) NOT NULL,
    name VARCHAR(50) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE
);

-- Section subjects (many-to-many relationship)
CREATE TABLE section_subjects (
    id SERIAL PRIMARY KEY,
    section_id VARCHAR(36) NOT NULL,
    subject_id VARCHAR(36) NOT NULL,
    FOREIGN KEY (section_id) REFERENCES sections(id) ON DELETE CASCADE,
    FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE,
    CONSTRAINT unique_section_subject UNIQUE (section_id, subject_id)
);

-- Timetable entries table
CREATE TABLE timetable_entries (
    id SERIAL PRIMARY KEY,
    section_id VARCHAR(36) NOT NULL,
    day VARCHAR(20) NOT NULL,
    period VARCHAR(10) NOT NULL,
    subject_id VARCHAR(36),
    teacher_id VARCHAR(36),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (section_id) REFERENCES sections(id) ON DELETE CASCADE,
    FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE SET NULL,
    FOREIGN KEY (teacher_id) REFERENCES teachers(id) ON DELETE SET NULL,
    CONSTRAINT unique_timetable_slot UNIQUE (section_id, day, period)
);

-- Create a function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for automatic updated_at updates
CREATE TRIGGER update_subjects_updated_at BEFORE UPDATE ON subjects
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_teachers_updated_at BEFORE UPDATE ON teachers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_classes_updated_at BEFORE UPDATE ON classes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_sections_updated_at BEFORE UPDATE ON sections
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_timetable_entries_updated_at BEFORE UPDATE ON timetable_entries
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert sample data (optional - comment out if not needed)

-- Sample subjects
INSERT INTO subjects (id, name, color) VALUES
('sub1', 'Mathematics', 'red'),
('sub2', 'English', 'blue'),
('sub3', 'Science', 'green'),
('sub4', 'History', 'yellow'),
('sub5', 'Physics', 'cyan');

-- Sample teachers
INSERT INTO teachers (id, name, lowest_class, highest_class) VALUES
('t1', 'Mr. Smith', 1, 12),
('t2', 'Mrs. Johnson', 1, 12),
('t3', 'Dr. Williams', 1, 12);

-- Sample teacher subjects
INSERT INTO teacher_subjects (teacher_id, subject_name) VALUES
('t1', 'Mathematics'),
('t2', 'English'),
('t3', 'Science'),
('t3', 'Physics');

-- Sample classes
INSERT INTO classes (id, name) VALUES
('1', 'Class 10'),
('2', 'Class 9');

-- Sample sections
INSERT INTO sections (id, class_id, name) VALUES
('s1', '1', 'A'),
('s2', '1', 'B'),
('s3', '2', 'A');

-- ─── Row Level Security (RLS) ────────────────────────────────
-- Supabase enables RLS by default. These policies allow full
-- public access via the anon key. Tighten these if you add auth.

ALTER TABLE subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE teachers ENABLE ROW LEVEL SECURITY;
ALTER TABLE teacher_subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE section_subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE timetable_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow full access to subjects" ON subjects FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow full access to teachers" ON teachers FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow full access to teacher_subjects" ON teacher_subjects FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow full access to classes" ON classes FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow full access to sections" ON sections FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow full access to section_subjects" ON section_subjects FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow full access to timetable_entries" ON timetable_entries FOR ALL USING (true) WITH CHECK (true);
