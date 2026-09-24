# ReseñaTap — MVP local

## Requisitos
- Node.js 18.17 o posterior
- Visual Studio Code

## Levantar local
1. Descomprimí la carpeta y abrila en VS Code.
2. Abrí Terminal > New Terminal.
3. Ejecutá:
   ```bash
   npm install
   npm run dev
   ```
4. Abrí http://localhost:3000

## Probar el flujo
1. En el panel, ingresá nombre del comercio y el link oficial para dejar reseñas de Google.
2. Registrá el comercio.
3. Copiá el enlace único generado y usá “Probar página”.
4. En la página del comercio, el botón abre el enlace de reseñas de Google.

## Importante: límites de este prototipo
- Los comercios se guardan en localStorage del navegador, no en un servidor. Por eso, un cliente desde otro teléfono no encontrará el registro todavía.
- Para pruebas con varios dispositivos o producción, hay que conectar una base de datos online (p. ej. Supabase) y desplegar la web con un dominio HTTPS.
- No publica reseñas automáticamente. El cliente escribe y publica dentro de Google.
- La app permite registrar un enlace de Google, pero no verifica que realmente pertenezca al comercio indicado. Verificalo manualmente al dar de alta.
- No usar para filtrar reseñas por puntuación; el acceso a Google debe ofrecerse de forma neutral.
