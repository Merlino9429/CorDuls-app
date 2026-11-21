import { Text, View } from 'react-native';
import { Muted, Screen, Subtitle } from '@/components/ui';
import { Colors, Spacing } from '@/constants/theme';

// ⚠️ BOZZA da completare e far verificare (dati aziendali tra parentesi quadre).
const SECTIONS: { title: string; body: string }[] = [
  { title: 'Titolare del trattamento', body: '[Ragione sociale], [indirizzo], P.IVA [numero]. Email: [email di contatto].' },
  { title: 'Dati che raccogliamo', body: 'Nome, email, telefono e indirizzo di consegna; ordini effettuati; punti della tessera; se attivi le notifiche, un identificativo tecnico del dispositivo o del browser. Non conserviamo i dati della carta: il pagamento avviene sulla pagina sicura di SumUp.' },
  { title: 'Perché li usiamo', body: 'Per gestire ordini, pagamenti, ritiro e consegna (esecuzione del contratto); per la tessera punti (adesione volontaria); per inviarti notifiche sugli ordini e, se le attivi, sulle promozioni (consenso, revocabile in ogni momento dalle impostazioni del telefono o del browser); per gli obblighi fiscali.' },
  { title: 'A chi li comunichiamo', body: 'Solo ai fornitori che ci permettono di offrire il servizio: Supabase (database e accesso), SumUp (pagamenti), Google (se scegli l’accesso con Google), il servizio di hosting del sito e i servizi di notifica di Apple, Google e del tuo browser.' },
  { title: 'Per quanto tempo', body: 'Finché hai un account. Se lo elimini, cancelliamo profilo, tessera punti e notifiche; gli ordini restano senza dati personali per il periodo richiesto dalla legge fiscale.' },
  { title: 'I tuoi diritti', body: 'Puoi chiedere accesso, rettifica, cancellazione, limitazione, portabilità e opposizione scrivendo a [email di contatto]. Puoi eliminare l’account in qualsiasi momento da Profilo → Elimina account. Hai diritto di reclamo al Garante per la protezione dei dati personali.' },
];

export default function PrivacyScreen() {
  return (
    <Screen>
      <Text style={{ fontSize: 24, fontWeight: '800', color: Colors.text, marginBottom: Spacing.sm }}>Informativa privacy</Text>
      <Muted>Ultimo aggiornamento: [data]</Muted>
      {SECTIONS.map((s) => (
        <View key={s.title}>
          <Subtitle>{s.title}</Subtitle>
          <Text style={{ color: Colors.text, fontSize: 15, lineHeight: 22 }}>{s.body}</Text>
        </View>
      ))}
    </Screen>
  );
}
