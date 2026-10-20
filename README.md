# Simulator prijave na poticaje za električna vozila (eFZOEU)

> **Neslužbena stranica za treniranje prijavljivanja na državne poticaje**  
> *Ova stranica nije službena usluga Fonda za zaštitu okoliša i energetsku učinkovitost (FZOEU) niti Vlade RH. Služi isključivo za vježbanje i simulaciju brzine unosa podataka.*

---

## ⚡ O projektu

Ovaj simulator omogućuje građanima i prijaviteljima uvježbavanje brzog i točnog ispunjavanja obrasca za sufinanciranje kupnje energetski učinkovitih vozila (**Javni poziv EnU-2/26**).

Zbog visoke navale i ograničenog proračuna gdje se sredstva dodjeljuju prema redoslijedu zaprimanja („najbrži prst”), svaka sekunda je ključna. Simulator vjerno replicira korisničko sučelje službenog sustava eFZOEU te uvodi mehaniku startnih F1 svjetala kako bi uvježbao vrijeme reakcije i brzinu unosa.

---

## 🚦 Ključne značajke

1. **F1 startna svjetla (FIA pravila):**
   - 5 crvenih svjetala koja se pale redom svake sekunde (1 do 5).
   - Nakon paljenja 5. svjetla odmah se pojavljuje obavijest *„Učitavanje prijavnice…”* uz rotirajući indikator.
   - Nasumično zadržavanje (holding phase) u rasponu od **0,2 do 3,0 sekunde** (službeni FIA interval).
   - Čim se svjetla ugase (*lights out*), prijavni obrazac se automatski otvara bez potrebe za dodatnim klikom.

2. **Mjerenje vremena (Štoperica):**
   - Mjeri se isključivo vrijeme pod kontrolom korisnika — od trenutka gašenja svjetala do potvrde na dijaloškom okviru *„Da, podnesi prijavu”*.

3. **Verifikacija unosa i DNF (Did Not Finish):**
   - U predvorju (lobby) možete postaviti svoj profil (ime, kontakt broj, e-mail, kategorija vozila, cijena, tražena subvencija).
   - Ako u predvorju unesete podatke, a tijekom utrke upišete nešto drugačije, prijava se proglašava nevažećom uz točan razlog (**DNF**).
   - Prerani start (jump start) ili prekid utrke (klik na navigacijski izbornik, tipka `Escape` ili gumb *„Prekini utrku”*) također rezultiraju DNF statusom.

4. **Slavlje osobnog rekorda (Personal Best):**
   - Ako imate barem dva pokušaja i trenutni je brži od vašeg prethodnog rekorda, simulator prikazuje slavljenički ekran s konfetima, peharom i porukom: *„Čestitamo! Srušili ste osobni rekord!”*.

5. **Dokumentacija i provjere prema PDF uputama:**
   - Podrška za stvarni odabir datoteka s diska ili brzi odabir oglednih dokumenata (`⚡ Ogledna` / `⚡ Učitaj sve ogledne dokumente`).
   - Simulacija provjera: obavezni `.xls`/`.xlsx` format za Prijavni obrazac, provjera praznih datoteka (0 B), provjera nedozvoljenih dijakritika (č, ć, ž, š, đ) i višestrukih razmaka, provjera duplikata naziva i ograničenje ukupne veličine na 100 MB.
   - Ugrađeni gumbi za testiranje grešaka sustava (`🧪 Testovi grešaka`).

6. **Autentičan dizajn i radno okruženje:**
   - Vjerna replika eFZOEU sučelja (kartice *Prijavitelj*, *Dokumentacija*, *Investicija*).
   - Sprječavanje automatskog popunjavanja preglednika (*autofill suppression*).
   - Fiksni desktop izgled (prilagođeno za rezolucije od 1280px naviše).
   - Prikaz lokalnog zagrebačkog vremena i odbrojavanje do službenog otvaranja (28. listopada 2026. u 09:00 CET).

---

## ⌨️ Prečaci na tipkovnici

- `Razmaknica (Space)`: Pokretanje utrke iz predvorja.
- `Escape (Esc)`: Prekid trenutne utrke (DNF).

---

## 🚀 Pokretanje lokalno

Pokrenite lokalni HTTP poslužitelj unutar korijenskog direktorija:

```bash
python3 -m http.server 8085
```

Zatim u pregledniku otvorite:
[http://localhost:8085](http://localhost:8085)