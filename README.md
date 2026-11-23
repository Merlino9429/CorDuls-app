# Cor Duls — App ordini

**Versione principale: web app su [corduls.it](https://corduls.it)**, installabile dal browser sulla schermata Home, senza passare dagli store (vedi [Pubblicare la web app](#pubblicare-la-web-app-ordinacordulsit)). Lo stesso codice può diventare in futuro anche un'app per App Store e Google Play (sezioni 4 e 5).

App per i clienti di Cor Duls: menu, combo e promozioni; ordini da ritirare in negozio o con consegna a domicilio; pagamento con carta tramite **SumUp** oppure in contanti; notifiche push.
La stessa app ha un'**area Admin**, visibile solo agli account amministratore, per gestire menu, foto, combo, promozioni, ordini, notifiche e impostazioni.

| Parte | Tecnologia |
|---|---|
| App mobile | Expo SDK 58 + React Native + Expo Router (TypeScript) |
| Database, login, foto | Supabase (Postgres con Row Level Security, Auth, Storage, Realtime) |
| Logica server | Supabase Edge Functions (Deno) |
| Pagamenti | SumUp Online Payments, con il checkout ospitato da SumUp |
| Notifiche push | Web Push del browser (web app) · Expo Push Service per le eventuali app degli store |
| Hosting web app | Netlify (oppure Cloudflare Pages) su `corduls.it` |

## Funzionalità

**Clienti**
- Menu diviso per categorie, con foto, allergeni e note sul prodotto ("senza zucchero").
- Combo, cioè menu composti da più prodotti a prezzo speciale.
- **Combo automatiche**: se nel carrello ci sono tutti i prodotti di una combo più conveniente, la combo viene applicata da sola e il carrello mostra il risparmio. Se più combo sono possibili, viene scelta la combinazione che fa risparmiare di più. Il server rifà sempre lo stesso calcolo (`src/lib/combos.ts`, copiato identico in `supabase/functions/_shared/combos.ts`; controlla l'allineamento con `npm run check:shared`).
- Promozioni: banner, sconti automatici e codici sconto.
- Carrello, che resta salvato anche se chiudi l'app.
- Ritiro o consegna, con scelta dell'orario ("prima possibile" o fasce da 15 minuti).
- Pagamento con carta, Apple Pay o Google Pay (SumUp), oppure in contanti se l'admin lo abilita.
- Stato dell'ordine aggiornato in tempo reale e notifica push a ogni cambio di stato.
- Registrazione e login con **email** oppure con **account Google**, e profilo con i dati salvati per i prossimi ordini.
- **Tessera punti**: ogni cliente ha un numero di tessera (es. `CD-12345678`) con il suo **codice QR** da mostrare in cassa, e guadagna punti sugli ordini completati, in base ai punti per euro che imposti. Può avere un bonus di benvenuto e spende i punti in premi al checkout (sconto in €). Se un ordine viene annullato, i punti del premio tornano indietro e quelli guadagnati vengono stornati.

**Admin** (tab "Admin")
- Dashboard con gli ordini attivi e l'incasso del giorno.
- Ordini in arrivo in tempo reale, con notifica push "Nuovo ordine". Lo stato si cambia con un tocco (in preparazione → pronto / in consegna → completato) e il cliente viene avvisato.
- Prodotti: crea, modifica ed elimina; prezzi; **caricamento foto dalla galleria**; disponibilità; elementi in evidenza.
- Categorie: crea, rinomina, riordina, nascondi.
- Combo: scegli prodotti e quantità e imposti il prezzo della combo.
- Promozioni: sconto in percentuale o in €, ordine minimo, codice, date di validità, foto, e invio di una notifica push a tutti con un tocco.
- Tessera punti: in cassa **scansioni il QR** della tessera del cliente con la fotocamera (Admin → Scansiona tessera), oppure cerchi il cliente per numero di tessera, nome, email o telefono, vedi saldo e movimenti, e aggiungi punti per una spesa fatta in negozio (calcolati dall'importo) oppure a mano. Crei e modifichi i premi.
- Notifiche push libere a tutti i clienti, con lo storico degli invii.
- Impostazioni: apertura e chiusura ordini, orari, ritiro e consegna, costo della consegna, ordine minimo, soglia per la consegna gratuita, contanti.

**Sicurezza**
- I prezzi e gli sconti vengono **sempre ricalcolati dal server** (`create-order`). Il cliente non può alterare il totale.
- Il pagamento viene confermato solo dopo aver riletto lo stato del pagamento da SumUp, controllando anche importo e riferimento.
- Row Level Security su tutte le tabelle: ogni cliente vede solo i propri ordini, e solo gli admin possono modificare il catalogo o caricare foto.
- Il ruolo admin non si può assegnare dall'app, solo dal database.

---

## Pubblicare la web app (corduls.it)

Servono: **Supabase** configurato (sezioni 2 e 3), un account gratuito **Netlify** e l'accesso al pannello DNS del dominio `corduls.it` (se il dominio è gestito da Wix: Wix → Domini → Gestisci record DNS).

1. **Chiavi per le notifiche web** (una volta sola):
   ```bash
   npx web-push generate-vapid-keys
   ```
   Metti la chiave pubblica e quella privata in `supabase/functions/.env` (`VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`), insieme a `APP_WEB_URL=https://corduls.it`, poi esegui di nuovo `supabase secrets set --env-file supabase/functions/.env` e pubblica le funzioni (anche `delete-account`).
2. **Supabase → Authentication → URL Configuration**:
   - Site URL: `https://corduls.it`
   - Redirect URLs: aggiungi `https://corduls.it/auth/callback`
3. **Netlify**: *Add new site → Import from Git*, scegli il repository `corduls-app`, branch `main` (il file `netlify.toml` imposta già build e cartella). In *Site configuration → Environment variables* aggiungi:
   - `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`
   - `EXPO_PUBLIC_VAPID_PUBLIC_KEY` (la chiave pubblica del punto 1)
4. **Dominio**: in Netlify *Manage → Name and address* il dominio principale è `corduls.it`, con `www.corduls.it` che rimanda lì. Nel DNS del dominio crea i record indicati da Netlify in **How to point it**: un record **A** per `@` verso l'IP di Netlify e un **CNAME** `www` → `corduls-app.netlify.app`. Netlify attiva da solo il certificato HTTPS, che è necessario per le notifiche e per l'installazione.
5. **Promozione**: metti il link `https://corduls.it` sui social, sul sito Wix e sul bancone. Stampa anche un QR con lo stesso indirizzo da mettere sul bancone.

Ogni modifica al codice pubblicata sul branch collegato aggiorna il sito in un paio di minuti, e i clienti la vedono alla riapertura dell'app.

**Notifiche nella web app**
- Android e computer: dopo l'accesso il cliente tocca **Attiva notifiche** (nel Profilo o nella Tessera).
- iPhone/iPad (iOS 16.4 o successivo): le notifiche funzionano solo con l'app **aggiunta alla schermata Home** (Safari → Condividi → Aggiungi alla schermata Home). L'app mostra queste istruzioni da sola.

**Da completare prima del lancio**
- Sostituire le icone provvisorie in `public/icons/` con il logo Cor Duls (192×192, 512×512, maskable 512×512 con margine del 20%, apple-touch-icon 180×180).
- Completare l'**informativa privacy** in `src/app/privacy.tsx` (dati aziendali tra parentesi quadre) e farla verificare.

### Hosting senza badge: Cloudflare Pages (alternativa gratuita)
Sul piano gratuito Netlify aggiunge in basso a destra il badge obbligatorio "Powered by Netlify". L'app gli lascia spazio in automatico (`src/lib/webOverlay.ts`), ma per toglierlo del tutto si può usare **Cloudflare Pages**, gratuito e senza badge:
1. dash.cloudflare.com → **Workers & Pages → Create → Pages → Connect to Git** e scegli `corduls-app`;
2. Framework preset: *None*; Build command: `npx expo export --platform web`; Build output directory: `dist`; variabile d'ambiente `NODE_VERSION` = `22`;
3. i valori pubblici dell'app sono già in `.env.production`, e `public/_redirects` e `public/_headers` funzionano anche su Cloudflare;
4. aggiungi l'indirizzo che ti dà Cloudflare (es. `corduls.pages.dev`) agli URL consentiti di Supabase (Authentication → URL Configuration) e imposta `APP_WEB_URL` nei segreti delle funzioni.

## 1. Requisiti e account necessari

| Cosa | Costo | Note |
|---|---|---|
| [Supabase](https://supabase.com) | gratis per iniziare | database, login, foto |
| [Expo / EAS](https://expo.dev) | gratis per iniziare | build dell'app e notifiche push |
| [SumUp](https://me.sumup.com) con Online Payments | commissione per transazione | serve una chiave API (`sk_...`) e il merchant code |
| [Netlify](https://netlify.com) | gratis | hosting della web app |
| Apple Developer Program | 99 $/anno | solo se in futuro pubblicate su App Store |
| Google Play Console | 25 $ una tantum | solo se in futuro pubblicate su Google Play |

Sul computer servono Node.js 20 o superiore e la [Supabase CLI](https://supabase.com/docs/guides/cli).

## 2. Configurare Supabase

1. Crea un progetto su supabase.com.
2. Collega la cartella ed esegui la migrazione:
   ```bash
   supabase login
   supabase link --project-ref <ID-PROGETTO>
   supabase db push                 # crea tabelle, sicurezza e bucket "images" (migrazioni 0001, 0002 e 0003)
   # facoltativo: dati di esempio
   psql "<connection string>" -f supabase/seed.sql
   ```
   In alternativa puoi incollare `supabase/migrations/0001_init.sql`, e poi `seed.sql`, nell'**SQL Editor** della dashboard.
3. In **Authentication → Providers → Email** decidi se chiedere la conferma via email.

### Accesso con Google
1. Su [Google Cloud Console](https://console.cloud.google.com) crea un progetto e configura la **schermata di consenso OAuth** (nome "Cor Duls", logo, email di contatto).
2. In **Credenziali → Crea credenziali → ID client OAuth**, scegli il tipo **Applicazione web**. Tra gli URI di reindirizzamento autorizzati inserisci `https://<ID-PROGETTO>.supabase.co/auth/v1/callback`.
3. In Supabase, **Authentication → Providers → Google**: attivalo e incolla Client ID e Client secret.
4. In Supabase, **Authentication → URL Configuration → Redirect URLs**: aggiungi `cordulsapp://auth/callback`.

> 📱 **iPhone e App Store.** Le regole di Apple (linea guida 4.8) chiedono che un'app con accesso tramite servizi di terze parti come Google offra anche un'opzione di accesso che rispetti la privacy, per esempio **Accedi con Apple**. Prima di pubblicare su iOS conviene aggiungerla: in Supabase il provider "Apple" funziona come quello di Google.

### Creare l'account admin
Registrati dall'app con la tua email, poi esegui nell'SQL Editor:
```sql
update public.profiles set role = 'admin'
where id = (select id from auth.users where email = 'tua@email.it');
```
Chiudi e riapri l'app: comparirà il tab **Admin**. Ripeti per ogni collaboratore.

## 3. Configurare SumUp

1. Nel pannello SumUp, sezione sviluppatori / API keys, crea una **chiave API segreta** e annota il **merchant code**.
2. Imposta i segreti delle funzioni:
   ```bash
   cp supabase/functions/.env.example supabase/functions/.env   # compila i valori
   supabase secrets set --env-file supabase/functions/.env
   ```
3. Pubblica le funzioni:
   ```bash
   supabase functions deploy create-order
   supabase functions deploy verify-payment
   supabase functions deploy update-order-status
   supabase functions deploy send-push
   supabase functions deploy delete-account
   supabase functions deploy sumup-webhook --no-verify-jwt
   supabase functions deploy payment-return --no-verify-jwt
   ```

Come funziona il pagamento: `create-order` crea l'ordine e un *checkout* SumUp con `hosted_checkout` abilitato. L'app apre la pagina di pagamento di SumUp. Al termine SumUp chiama `sumup-webhook` e rimanda il cliente a `payment-return`, che lo riporta nell'app. In entrambi i casi lo stato viene riletto da SumUp prima di segnare l'ordine come pagato.

> ⚠️ **Da verificare prima di andare live.** L'integrazione SumUp è tutta in `supabase/functions/_shared/sumup.ts`. Questi sono i punti da controllare sulla [documentazione SumUp](https://developer.sumup.com/online-payments/) attuale:
> - i nomi dei campi `hosted_checkout` / `hosted_checkout_url`, `return_url` e `redirect_url`;
> - i valori di stato `PAID`, `FAILED` ed `EXPIRED`;
> - il formato del webhook (`{ "id": "<checkout id>" }`).
>
> Fai una prova in modalità test con importi piccoli.

## 4. Configurare l'app

```bash
npm install
cp .env.example .env.local      # inserisci URL e anon key di Supabase
npx eas-cli@latest login
npx eas-cli@latest init         # crea il progetto EAS e il projectId, necessario per le push
```

Per personalizzare l'app:
- **Nome, icone e splash**: `app.json` e `assets/images/` (sostituisci `icon.png`, `splash-icon.png` e le icone Android con il logo Cor Duls).
- **Colori del brand**: `src/constants/theme.ts`.
- **Bundle ID**: `it.corduls.app` in `app.json`. Cambialo se preferisci, prima della prima pubblicazione.

### Provare l'app sul telefono
Le notifiche push e il ritorno automatico dal pagamento richiedono una **development build**. Expo Go non basta.
```bash
npx eas-cli@latest build --profile development --platform android   # oppure ios
npx expo start --dev-client
```

### Notifiche push
- **Android**: in `eas credentials` (oppure seguendo la guida Expo "FCM credentials") carica la chiave del service account di Firebase.
- **iOS**: EAS genera da solo la chiave APNs alla prima build iOS.
- Le notifiche partono in questi casi: un nuovo ordine (avviso agli admin), un cambio di stato dell'ordine (avviso al cliente), un invio manuale o una nuova promo (avviso a tutti).

## 5. Pubblicare sugli store

```bash
npx eas-cli@latest build --profile production --platform all
npx eas-cli@latest submit --platform ios
npx eas-cli@latest submit --platform android
```
Gli aggiornamenti che toccano solo il codice JavaScript si possono pubblicare senza passare dagli store con `eas update`.

> Apple consente pagamenti esterni come SumUp perché si tratta di **beni fisici** (cibo e prodotti). Gli acquisti in-app di Apple non servono.

---

## Struttura del progetto

```
src/
  app/                    schermate (Expo Router)
    (tabs)/               Menu, Promo, Carrello, Ordini, Profilo, Admin
    product/[id].tsx      dettaglio prodotto
    combo/[id].tsx        dettaglio combo
    checkout.tsx          ritiro/consegna, orario, pagamento
    order/[id].tsx        stato ordine (e gestione per l'admin)
    login.tsx             accesso e registrazione
    admin/                ordini, prodotti, categorie, combo, promozioni, notifiche, impostazioni
  components/             componenti UI condivisi e caricamento foto
  lib/                    client Supabase, login, carrello, push, utilità
supabase/
  migrations/0001_init.sql  schema, sicurezza (RLS), storage
  seed.sql                  dati di esempio
  functions/                create-order, verify-payment, sumup-webhook,
                            payment-return, update-order-status, send-push
```

## Comandi utili

```bash
npx tsc --noEmit          # controllo dei tipi
npx eslint .              # lint
npx expo start            # server di sviluppo
```

## Possibili sviluppi futuri
- Varianti e aggiunte a pagamento per i prodotti (es. taglia, extra panna).
- Zone di consegna con costi diversi per CAP, e limite di ordini per fascia oraria.
- Rimborso automatico SumUp quando un ordine pagato viene annullato (oggi va fatto dalla dashboard SumUp).
- Programma fedeltà o raccolta punti.
- Stampa automatica della comanda.
