import { Router } from 'express';
import { createRequire } from 'module';
import { supabase, supabaseAdmin } from '../config/supabase.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
const require = createRequire(import.meta.url);

// Lazy load para evitar crashes al inicializar la función serverless
let _pdfParse, _JSZip;
function getPdfParse() { return (_pdfParse ??= require('pdf-parse')); }
function getJSZip()    { return (_JSZip    ??= require('jszip')); }

const STORAGE_BUCKET = process.env.SUPABASE_STORAGE_BUCKET || 'libros';
const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
]);
const ALLOWED_COVER_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
]);

function slugify(text) {
  return String(text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 50);
}

function getExtension(fileName, mimeType) {
  const normalizedName = (fileName || '').toLowerCase();
  if (normalizedName.endsWith('.pdf')) return 'pdf';
  if (normalizedName.endsWith('.docx')) return 'docx';
  if (normalizedName.endsWith('.doc')) return 'doc';

  if (mimeType === 'application/pdf') return 'pdf';
  if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') return 'docx';
  if (mimeType === 'application/msword') return 'doc';
  return 'bin';
}

function getCoverExtension(fileName, mimeType) {
  const normalizedName = (fileName || '').toLowerCase();
  if (normalizedName.endsWith('.jpg') || normalizedName.endsWith('.jpeg')) return 'jpg';
  if (normalizedName.endsWith('.png')) return 'png';
  if (normalizedName.endsWith('.webp')) return 'webp';
  if (normalizedName.endsWith('.gif')) return 'gif';

  if (mimeType === 'image/jpeg') return 'jpg';
  if (mimeType === 'image/png') return 'png';
  if (mimeType === 'image/webp') return 'webp';
  if (mimeType === 'image/gif') return 'gif';
  return 'img';
}

function extractBase64Payload(raw) {
  if (!raw || typeof raw !== 'string') return '';
  const commaIdx = raw.indexOf(',');
  return commaIdx >= 0 ? raw.slice(commaIdx + 1) : raw;
}

async function getPdfPageCount(fileBuffer) {
  try {
    const result = await getPdfParse()(fileBuffer);
    const count = Number(result?.numpages);
    if (Number.isInteger(count) && count > 0) return count;
  } catch (error) {
    console.warn('Could not parse PDF page count:', error?.message || error);
  }

  // Fallback simple para PDFs que no exponen metadata de páginas al parser.
  try {
    const raw = fileBuffer.toString('latin1');
    const matches = raw.match(/\/Type\s*\/Page\b/g);
    if (matches && matches.length > 0) return matches.length;
  } catch (error) {
    console.warn('Could not infer PDF page count from raw content:', error?.message || error);
  }

  // Como último recurso en un PDF subido, registrar al menos 1 página.
  return 1;
}

function estimatePagesFromTextLength(text = '') {
  const clean = String(text).replace(/\s+/g, ' ').trim();
  if (!clean) return 1;

  // Aproximación: ~1800 caracteres de texto por página.
  return Math.max(1, Math.ceil(clean.length / 1800));
}

async function getDocxEstimatedPageCount(fileBuffer) {
  try {
    const zip = await getJSZip().loadAsync(fileBuffer);
    const documentXmlEntry = zip.file('word/document.xml');
    if (!documentXmlEntry) return 1;

    const documentXml = await documentXmlEntry.async('string');
    const manualBreaks = (documentXml.match(/<w:br[^>]*w:type="page"[^>]*\/?>(?:<\/w:br>)?/g) || []).length;
    const renderedBreaks = (documentXml.match(/<w:lastRenderedPageBreak\s*\/?>(?:<\/w:lastRenderedPageBreak>)?/g) || []).length;
    const explicitPages = manualBreaks + renderedBreaks + 1;

    const xmlWithoutTags = documentXml.replace(/<[^>]+>/g, ' ');
    const textEstimatedPages = estimatePagesFromTextLength(xmlWithoutTags);

    return Math.max(1, explicitPages, textEstimatedPages);
  } catch (error) {
    console.warn('Could not estimate DOCX page count:', error?.message || error);
    return 1;
  }
}

function getDocEstimatedPageCount(fileBuffer) {
  try {
    const binary = fileBuffer.toString('latin1');
    const manualPageBreaks = (binary.match(/\f/g) || []).length;
    if (manualPageBreaks > 0) return manualPageBreaks + 1;

    // Fallback aproximado para .doc legacy.
    return Math.max(1, Math.ceil(fileBuffer.length / 2500));
  } catch (error) {
    console.warn('Could not estimate DOC page count:', error?.message || error);
    return 1;
  }
}

async function getPageCountByMimeType(fileBuffer, mimeType) {
  if (mimeType === 'application/pdf') {
    return getPdfPageCount(fileBuffer);
  }

  if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
    return getDocxEstimatedPageCount(fileBuffer);
  }

  if (mimeType === 'application/msword') {
    return getDocEstimatedPageCount(fileBuffer);
  }

  return 1;
}

async function ensureUniqueSlug(baseSlug) {
  let slug = baseSlug;
  let counter = 1;

  while (true) {
    const { data: existing, error } = await supabaseAdmin
      .from('libros')
      .select('id')
      .eq('slug', slug)
      .maybeSingle();

    if (error) throw error;
    if (!existing) return slug;

    slug = `${baseSlug}-${counter}`;
    counter += 1;
  }
}

async function resolveAutorId(usuarioId) {
  if (!usuarioId) return null;

  const { data: autor, error } = await supabaseAdmin
    .from('autores')
    .select('id')
    .eq('usuario_id', usuarioId)
    .maybeSingle();

  if (error) throw error;
  return autor?.id ?? null;
}

async function ensureCategoria(categoriaNombre) {
  const normalized = String(categoriaNombre || '').trim();
  if (!normalized) return null;

  const { data: existing, error: existingError } = await supabaseAdmin
    .from('categorias')
    .select('id')
    .eq('nombre', normalized)
    .maybeSingle();

  if (existingError) throw existingError;
  if (existing) return existing.id;

  const categoriaSlug = slugify(normalized) || `categoria-${Date.now()}`;
  const { data: created, error: createError } = await supabaseAdmin
    .from('categorias')
    .insert({ nombre: normalized, slug: categoriaSlug })
    .select('id')
    .single();

  if (createError) throw createError;
  return created.id;
}

// POST /api/libros/upload
router.post('/upload', requireAuth, async (req, res) => {
  try {
    const { 
      titulo, 
      descripcion, 
      categoria, 
      edad_rango, 
      anio,
      fileName,
      fileBase64,
      mimeType,
      coverName,
      coverBase64,
      coverMimeType
    } = req.body;

    if (!titulo || !descripcion || !categoria || !edad_rango) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    if (!fileName || !fileBase64 || !mimeType) {
      return res.status(400).json({ error: 'File data is required' });
    }

    if (!ALLOWED_MIME_TYPES.has(mimeType)) {
      return res.status(400).json({ error: 'Unsupported file type. Only PDF is allowed. Convert Word to PDF before uploading.' });
    }

    const base64Payload = extractBase64Payload(fileBase64);
    const fileBuffer = Buffer.from(base64Payload, 'base64');
    if (!fileBuffer || fileBuffer.length === 0) {
      return res.status(400).json({ error: 'Invalid file payload' });
    }

    if (fileBuffer.length > 25 * 1024 * 1024) {
      return res.status(400).json({ error: 'File exceeds 25MB limit' });
    }

    const baseSlug = slugify(titulo) || `libro-${Date.now()}`;
    const slug = await ensureUniqueSlug(baseSlug);

    const extension = getExtension(fileName, mimeType);
    const storagePath = `libros/${req.user.id}/${Date.now()}-${slug}.${extension}`;

    const { error: uploadError } = await supabaseAdmin.storage
      .from(STORAGE_BUCKET)
      .upload(storagePath, fileBuffer, {
        contentType: mimeType,
        upsert: false,
      });

    if (uploadError) {
      console.error('Storage upload error:', uploadError);
      return res.status(500).json({ error: 'Failed to upload file to storage', details: uploadError.message });
    }

    const { data: publicUrlData } = supabaseAdmin.storage
      .from(STORAGE_BUCKET)
      .getPublicUrl(storagePath);

    const contenidoUrl = publicUrlData?.publicUrl;
    if (!contenidoUrl) {
      return res.status(500).json({ error: 'Could not generate file URL' });
    }

    let portadaIcono = '📚';
    if (coverName || coverBase64 || coverMimeType) {
      if (!coverName || !coverBase64 || !coverMimeType) {
        return res.status(400).json({ error: 'Incomplete cover data' });
      }

      if (!ALLOWED_COVER_MIME_TYPES.has(coverMimeType)) {
        return res.status(400).json({ error: 'Unsupported cover type. Only JPG, PNG, WEBP or GIF are allowed.' });
      }

      const coverBase64Payload = extractBase64Payload(coverBase64);
      const coverBuffer = Buffer.from(coverBase64Payload, 'base64');
      if (!coverBuffer || coverBuffer.length === 0) {
        return res.status(400).json({ error: 'Invalid cover payload' });
      }

      if (coverBuffer.length > 5 * 1024 * 1024) {
        return res.status(400).json({ error: 'Cover image exceeds 5MB limit' });
      }

      const coverExtension = getCoverExtension(coverName, coverMimeType);
      const coverStoragePath = `portadas/${req.user.id}/${Date.now()}-${slug}.${coverExtension}`;

      const { error: coverUploadError } = await supabaseAdmin.storage
        .from(STORAGE_BUCKET)
        .upload(coverStoragePath, coverBuffer, {
          contentType: coverMimeType,
          upsert: false,
        });

      if (coverUploadError) {
        console.error('Cover upload error:', coverUploadError);
        return res.status(500).json({ error: 'Failed to upload cover image', details: coverUploadError.message });
      }

      const { data: coverPublicUrlData } = supabaseAdmin.storage
        .from(STORAGE_BUCKET)
        .getPublicUrl(coverStoragePath);

      if (!coverPublicUrlData?.publicUrl) {
        return res.status(500).json({ error: 'Could not generate cover URL' });
      }

      portadaIcono = coverPublicUrlData.publicUrl;
    }

    const pageCount = await getPageCountByMimeType(fileBuffer, mimeType);
    const paginas = [];

    const autorId = await resolveAutorId(req.user.id);

    const libroPayload = {
      titulo,
      slug,
      descripcion,
      autor_id: autorId,
      edad_rango,
      paginas: pageCount,
      anio: parseInt(anio) || new Date().getFullYear(),
      contenido_url: contenidoUrl,
      publicado: true,
      destacado: false,
      nuevo: true,
      portada_icono: portadaIcono,
      portada_gradiente: 'from-purple-500 to-pink-500'
    };

    const { data: libro, error } = await supabaseAdmin
      .from('libros')
      .insert([libroPayload])
      .select()
      .single();

    if (error) {
      console.error('Supabase insert error:', error);
      return res.status(500).json({ error: 'Failed to save book', details: error.message });
    }

    if (paginas && paginas.length > 0) {
      try {
        await supabaseAdmin
          .from('paginas_libro')
          .insert(
            paginas.map((p, index) => ({
              libro_id: libro.id,
              numero: p.numero || index + 1,
              titulo: p.titulo || `Página ${index + 1}`,
              contenido: p.contenido || ''
            }))
          );
        console.log(`Guardadas ${paginas.length} páginas para libro ${libro.id}`);
      } catch (pageError) {
        console.warn('Could not save pages in paginas_libro table:', pageError);
      }
    }

    const categoriaId = await ensureCategoria(categoria);
    if (categoriaId) {
      await supabaseAdmin
        .from('libros_categorias')
        .insert({ libro_id: libro.id, categoria_id: categoriaId });
    }
    
    res.status(201).json({
      id: libro.id,
      slug: libro.slug,
      titulo: libro.titulo,
      contenido_url: libro.contenido_url,
      portada_icono: libro.portada_icono,
      paginas_count: libro.paginas ?? paginas.length,
      message: 'Book uploaded successfully'
    });

  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: error.message || 'Upload failed' });
  }
});

export default router;

