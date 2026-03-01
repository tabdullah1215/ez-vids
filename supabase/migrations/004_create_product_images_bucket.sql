-- Create a public storage bucket for product images
INSERT INTO storage.buckets (id, name, public)
VALUES ('product-images', 'product-images', true)
ON CONFLICT (id) DO NOTHING;

-- Allow public read access
CREATE POLICY "Allow public read on product-images"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'product-images');

-- Allow service role insert
CREATE POLICY "Allow service role insert on product-images"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'product-images');

-- Allow service role delete
CREATE POLICY "Allow service role delete on product-images"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'product-images');
