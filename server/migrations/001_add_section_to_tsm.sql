-- Migration: Add section_id to teacher_subject_map for batch-level mapping
-- Run this in your Supabase SQL Editor (https://supabase.com/dashboard → SQL Editor)

-- Add nullable section_id column
ALTER TABLE teacher_subject_map ADD COLUMN IF NOT EXISTS section_id VARCHAR(36) NULL;

-- Add foreign key to sections table
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'fk_tsm_section'
  ) THEN
    ALTER TABLE teacher_subject_map 
      ADD CONSTRAINT fk_tsm_section 
      FOREIGN KEY (section_id) REFERENCES sections(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Drop old unique constraint (class-level only)
ALTER TABLE teacher_subject_map DROP CONSTRAINT IF EXISTS unique_teacher_subject_class;

-- Add new unique index that handles NULL section_id
-- NULL section_id = "all batches in this class"
-- Specific section_id = "only that batch"
CREATE UNIQUE INDEX IF NOT EXISTS unique_teacher_subject_class_section 
  ON teacher_subject_map (teacher_id, subject_id, class_id, COALESCE(section_id, '__ALL__'));

-- Enable RLS policy (if not already)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'teacher_subject_map' 
    AND policyname = 'Allow full access to teacher_subject_map'
  ) THEN
    CREATE POLICY "Allow full access to teacher_subject_map" 
      ON teacher_subject_map FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;
