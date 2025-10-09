-- Migration: create_tax_documents_table
-- Created: 2024-01-01T00:00:00.000Z

-- Create tax_documents table
CREATE TABLE tax_documents (
  id SERIAL PRIMARY KEY,
  member_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  file_name VARCHAR(255) NOT NULL,
  original_name VARCHAR(255) NOT NULL,
  file_path VARCHAR(500) NOT NULL,
  file_type VARCHAR(100) NOT NULL,
  file_size INTEGER NOT NULL,
  document_type VARCHAR(100) NOT NULL,
  tax_year INTEGER NOT NULL,
  uploaded_by INTEGER NOT NULL REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX idx_tax_documents_member_id ON tax_documents(member_id);
CREATE INDEX idx_tax_documents_tax_year ON tax_documents(tax_year);
CREATE INDEX idx_tax_documents_document_type ON tax_documents(document_type);
CREATE INDEX idx_tax_documents_uploaded_by ON tax_documents(uploaded_by);

-- Create updated_at trigger for tax_documents
CREATE TRIGGER update_tax_documents_updated_at 
  BEFORE UPDATE ON tax_documents 
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();
