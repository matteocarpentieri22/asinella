# Asinella · Piadine del giovedì 🫓

Web app (ottimizzata per smartphone) per ordinare la piadina del giovedì dopo allenamento.

- **Giocatori**: entrano con nome e cognome, compongono la piadina (animazione), la inviano (si chiude), vedono gli ordini di tutti in tempo reale.
- **Admin** (`/#/admin`, protetto da PIN): crea la serata con la scadenza, inserisce gli ingredienti della settimana (salumi, formaggi, verdure, salse), vede gli ordini e copia il riepilogo pronto per Asinella/WhatsApp.

Stack: Vite + React + TypeScript, Framer Motion, Supabase.

## 1. Supabase

1. Apri il progetto su supabase.com → **SQL Editor** → *New query*.
2. Incolla tutto il contenuto di [`supabase/schema.sql`](supabase/schema.sql) e premi **Run**.
   Se avevi già eseguito una versione precedente, basta eseguire [`supabase/migration-dispensa.sql`](supabase/migration-dispensa.sql) (dispensa + una serata alla volta).
3. PIN admin iniziale: **`asinella`** → cambialo subito dal pannello admin ("Cambia PIN admin").
4. Prendi URL e chiave pubblica da **Project Settings → API**:
   - `Project URL`
   - `anon public` key

## 2. Sviluppo locale

```bash
cp .env.example .env.local   # poi incolla URL e anon key
npm install
npm run dev
```

Senza `.env.local`, `npm run dev` parte in **modalità demo** con dati finti in memoria (PIN admin demo: `asinella`).

## 3. Immagini degli ingredienti con Gemini

Le immagini vengono generate da una **Supabase Edge Function** ([`supabase/functions/generate-ingredient`](supabase/functions/generate-ingredient/index.ts)).
La chiave Gemini resta **solo su Supabase**, mai nell'app.

1. Crea la chiave su [Google AI Studio](https://aistudio.google.com/apikey).
2. Da questa cartella, nel terminale:

   ```bash
   npx supabase login
   npx supabase link --project-ref IL_TUO_PROJECT_REF
   npx supabase secrets set GEMINI_API_KEY=la_tua_chiave
   npx supabase functions deploy generate-ingredient
   ```

   Il *project ref* è la parte prima di `.supabase.co` nel Project URL.
   In alternativa la chiave si può inserire da **Supabase → Edge Functions → Secrets**.
3. Nell'area admin: **Genera immagini** crea tutte quelle mancanti (una alla volta, ognuna usa le precedenti come riferimento di stile).
   Tocca un ingrediente per vedere l'anteprima, **Rigenera** se non piace, oppure **Usa il disegno**.

Facoltativi (segreti): `GEMINI_IMAGE_MODEL` (default `gemini-nano-banana-2.1`), `GEMINI_TEXT_MODEL` (default `gemini-3.1-flash-lite`, usato per il colore delle salse).
Ogni immagine si genera una volta sola (pochi centesimi) e poi viene riusata in tutte le settimane.

## 4. Deploy su Vercel

1. vercel.com → *Add New Project* → importa questo repo GitHub.
2. Framework: **Vite** (rilevato in automatico).
3. Environment Variables: `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`.
4. Deploy → manda il link nel gruppo. Da iPhone/Android: "Aggiungi a schermata Home" per averla come app.

## Note

- Accesso solo con nome e cognome: comodo, ma chiunque può scrivere il nome di un altro. Per una squadra va bene; se serve si può aggiungere un PIN personale.
- Gli ingredienti hanno illustrazioni dedicate (cotto, crudo, speck, pancetta, salame, mortadella, formaggi a fetta, provola, brie, mozzarella, squacquerone, gorgonzola, zucchine, melanzane, insalata, rucola, pomodoro, peperoni, cipolla, funghi, patate, olive, salse…). Un ingrediente sconosciuto usa il disegno generico della sua categoria. Quando c'è un'immagine generata da Gemini, l'app usa quella; il disegno resta come riserva.
