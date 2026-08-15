-- O bucket `avatars` estava com file_size_limit de 2MB, metade do
-- `community-images`. O app já entrega um JPEG de ~400px (dezenas de KB), mas
-- 2MB não deixa folga nenhuma pra qualquer foto que escape do redimensionamento.
-- Sobe pra 5MB, igual aos outros buckets de imagem.
--
-- A lista de mime types continua fechada em jpeg/png/webp de propósito: aceitar
-- HEIC aqui guardaria um arquivo que Android e desktop não exibem — a conversão
-- pra JPEG é feita no cliente (src/lib/imageCompression.ts).
update storage.buckets
set file_size_limit = 5242880
where id = 'avatars';
