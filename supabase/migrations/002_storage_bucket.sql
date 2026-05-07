-- Nirnay storage bucket setup.
-- Run this once in the Supabase SQL editor (or create the bucket manually
-- via Storage > New bucket: name "documents", public, 50 MB limit).

INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('documents', 'documents', true, 52428800)
ON CONFLICT (id) DO UPDATE
  SET public = EXCLUDED.public,
      file_size_limit = EXCLUDED.file_size_limit;

-- Permissive policies for the POC. Tighten for production.
DROP POLICY IF EXISTS "Allow public read on documents" ON storage.objects;
DROP POLICY IF EXISTS "Allow public write on documents" ON storage.objects;
DROP POLICY IF EXISTS "Allow public update on documents" ON storage.objects;
DROP POLICY IF EXISTS "Allow public delete on documents" ON storage.objects;

CREATE POLICY "Allow public read on documents"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'documents');

CREATE POLICY "Allow public write on documents"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'documents');

CREATE POLICY "Allow public update on documents"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'documents')
  WITH CHECK (bucket_id = 'documents');

CREATE POLICY "Allow public delete on documents"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'documents');
