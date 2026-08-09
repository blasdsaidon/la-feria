# La Feria

App web para gestionar stock, ventas, clientes, proveedores y pagos de una
feria americana.

## Desarrollo local

1. Instalar dependencias:

   ```bash
   npm install
   ```

2. Crear `.env.local` usando `.env.example` como guia.

3. Iniciar:

   ```bash
   npm run dev
   ```

## Variables en Vercel

En Vercel, cargar estas variables en Project Settings > Environment Variables:

```text
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY
```

## Respaldo

`legacy-static.html` conserva la version anterior empaquetada en un solo archivo.
