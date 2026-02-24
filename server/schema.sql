-- Timetable Database Schema for PostgreSQL/Supabase
-- Run this SQL in Supabase SQL Editor to create the required tables

-- Drop tables if they exist (in reverse order of dependencies)
DROP TABLE IF EXISTS timetable_entries CASCADE;
DROP TABLE IF EXISTS section_subjects CASCADE;
DROP TABLE IF EXISTS subject_classes CASCADE;
DROP TABLE IF EXISTS teacher_subject_map CASCADE;
DROP TABLE IF EXISTS teacher_subjects CASCADE;
DROP TABLE IF EXISTS sections CASCADE;
DROP TABLE IF EXISTS classes CASCADE;
DROP TABLE IF EXISTS teachers CASCADE;
DROP TABLE IF EXISTS subjects CASCADE;

-- Subjects table (all subjects use orange color by default — no color column)
CREATE TABLE subjects (
    id VARCHAR(36) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Teachers table
CREATE TABLE teachers (
    id VARCHAR(36) PRIMARY KEY,
    teacher_code VARCHAR(20) UNIQUE,
    name VARCHAR(100) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Classes table
CREATE TABLE classes (
    id VARCHAR(36) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    display_order INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Sections table
CREATE TABLE sections (
    id VARCHAR(36) PRIMARY KEY,
    class_id VARCHAR(36) NOT NULL,
    name VARCHAR(50) NOT NULL,
    display_order INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE
);

-- Subject classes (which classes a subject is assigned to + periods per week target)
CREATE TABLE subject_classes (
    id SERIAL PRIMARY KEY,
    subject_id VARCHAR(36) NOT NULL,
    class_id VARCHAR(36) NOT NULL,
    periods_per_week INT DEFAULT 0,
    FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE,
    FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE,
    CONSTRAINT unique_subject_class UNIQUE (subject_id, class_id)
);

-- Section subjects (per-section control, nullable periods_per_week = inherit from subject_classes)
CREATE TABLE section_subjects (
    id SERIAL PRIMARY KEY,
    section_id VARCHAR(36) NOT NULL,
    subject_id VARCHAR(36) NOT NULL,
    periods_per_week INT,
    FOREIGN KEY (section_id) REFERENCES sections(id) ON DELETE CASCADE,
    FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE,
    CONSTRAINT unique_section_subject UNIQUE (section_id, subject_id)
);

-- Teacher subject map (which teacher can teach which subject in which class/batch)
-- section_id NULL = all batches in the class, specific section_id = only that batch
CREATE TABLE teacher_subject_map (
    id SERIAL PRIMARY KEY,
    teacher_id VARCHAR(36) NOT NULL,
    subject_id VARCHAR(36) NOT NULL,
    class_id VARCHAR(36) NOT NULL,
    section_id VARCHAR(36) NULL,
    FOREIGN KEY (teacher_id) REFERENCES teachers(id) ON DELETE CASCADE,
    FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE,
    FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE,
    FOREIGN KEY (section_id) REFERENCES sections(id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX unique_teacher_subject_class_section 
  ON teacher_subject_map (teacher_id, subject_id, class_id, COALESCE(section_id, '__ALL__'));

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

-- Auto-update updated_at on row changes
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

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

-- ─── Row Level Security ──────────────────────────────────
-- The Node.js server uses the service_role key which bypasses RLS,
-- but we enable + allow full access so the Supabase dashboard also works.

ALTER TABLE subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE teachers ENABLE ROW LEVEL SECURITY;
ALTER TABLE classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE subject_classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE section_subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE teacher_subject_map ENABLE ROW LEVEL SECURITY;
ALTER TABLE timetable_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow full access to subjects" ON subjects FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow full access to teachers" ON teachers FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow full access to classes" ON classes FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow full access to sections" ON sections FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow full access to subject_classes" ON subject_classes FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow full access to section_subjects" ON section_subjects FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow full access to teacher_subject_map" ON teacher_subject_map FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow full access to timetable_entries" ON timetable_entries FOR ALL USING (true) WITH CHECK (true);

-- ─── Sample Data (optional) ──────────────────────────────

INSERT INTO subjects (id, name) VALUES
('sub1', 'Mathematics'),
('sub2', 'English'),
('sub3', 'Science'),
('sub4', 'History'),
('sub5', 'Physics');

INSERT INTO teachers (id, name) VALUES
('t1', 'Mr. Smith'),
('t2', 'Mrs. Johnson'),
('t3', 'Dr. Williams');

INSERT INTO classes (id, name) VALUES
('1', 'Class 10'),
('2', 'Class 9');

INSERT INTO sections (id, class_id, name) VALUES
('s1', '1', 'A'),
('s2', '1', 'B'),
('s3', '2', 'A');

-- Assign subjects to classes with periods per week
INSERT INTO subject_classes (subject_id, class_id, periods_per_week) VALUES
('sub1', '1', 6), ('sub1', '2', 6),
('sub2', '1', 5), ('sub2', '2', 5),
('sub3', '1', 4),
('sub5', '1', 3);

-- Auto-assign to all sections of those classes
INSERT INTO section_subjects (section_id, subject_id) VALUES
('s1', 'sub1'), ('s2', 'sub1'), ('s3', 'sub1'),
('s1', 'sub2'), ('s2', 'sub2'), ('s3', 'sub2'),
('s1', 'sub3'), ('s2', 'sub3'),
('s1', 'sub5'), ('s2', 'sub5');

-- Sample teacher-subject-class mappings
INSERT INTO teacher_subject_map (teacher_id, subject_id, class_id) VALUES
('t1', 'sub1', '1'), ('t1', 'sub1', '2'),
('t2', 'sub2', '1'), ('t2', 'sub2', '2'),
('t3', 'sub3', '1'),
('t3', 'sub5', '1');
