// ============================================================================
// Entre Mascotas · Cliente de Supabase
// Inicializa y expone window.sb a partir de window.APP_CONFIG y supabase-js v2
// ============================================================================

(function () {
  window.sb = null;

  const config = window.APP_CONFIG;

  if (!config || !config.SUPABASE_URL || !config.SUPABASE_KEY) {
    console.error(
      '[Supabase] Configuración incompleta: Asegurate de definir SUPABASE_URL y SUPABASE_KEY en window.APP_CONFIG.'
    );
    return;
  }

  if (typeof window.supabase === 'undefined' || typeof window.supabase.createClient !== 'function') {
    console.error(
      '[Supabase] La biblioteca @supabase/supabase-js no se cargó correctamente desde el CDN.'
    );
    return;
  }

  try {
    // Normalizar la URL: si se ingresó la URL del endpoint REST (.../rest/v1/),
    // supabase-js v2 necesita la raíz del proyecto (https://<project-ref>.supabase.co)
    // para enrutar correctamente Auth, REST, Storage y Realtime.
    const rawUrl = String(config.SUPABASE_URL).trim();
    const cleanUrl = rawUrl.replace(/\/rest\/v1\/?$/i, '').replace(/\/+$/, '');

    window.sb = window.supabase.createClient(cleanUrl, config.SUPABASE_KEY, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true
      }
    });

    console.info('[Supabase] Cliente inicializado exitosamente en window.sb');
  } catch (error) {
    console.error('[Supabase] Error al inicializar el cliente de Supabase:', error);
  }
})();
