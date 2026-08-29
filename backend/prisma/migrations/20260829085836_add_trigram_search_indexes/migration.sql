-- Búsqueda tolerante a variaciones de escritura (docs/03-modelo-de-datos.md §4
-- y docs/04-importacion-y-precios.md §5): "bomba agua" debe encontrar
-- "BOMBA DE AGUA", "BBA AGUA", "BOMBA AGUA MB", etc.
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS unaccent;

CREATE INDEX IF NOT EXISTS customers_business_name_trgm_idx
  ON customers USING gin (business_name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS products_description_trgm_idx
  ON products USING gin (description gin_trgm_ops);

CREATE INDEX IF NOT EXISTS product_supplier_references_description_trgm_idx
  ON product_supplier_references USING gin (supplier_description gin_trgm_ops);
