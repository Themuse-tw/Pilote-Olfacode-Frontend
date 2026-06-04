# 🎯 Pilote Olfacode — Assistant CEO

Une application web autonome, **100% client-side**, qui devient ton copilote d'exécution pour Olfacode.

> Aucun backend à déployer. Aucun service à maintenir. Tu ouvres, tu utilises. Tes données restent sur ton appareil.

---

## ✨ Ce que ça fait

- **💬 Chat IA contextualisé** — l'assistant connaît Olfacode, sa vision, tes objectifs. Il a en permanence l'état de ta roadmap, ton budget, ton pipeline prospects, ton journal de décisions.
- **🎙️ Mode vocal** — tu parles, il transcrit (Whisper), il répond, il lit la réponse à haute voix (TTS OpenAI). Mains libres.
- **🗺️ Roadmap** — tâches par trimestre, priorité, deadline, cases à cocher. Pré-rempli avec ta vraie roadmap actuelle.
- **💰 Budget** — trésorerie, revenus, dépenses récurrentes ou one-shot. KPIs du mois en cours.
- **🎯 CRM Prospects** — 5 personas, 8 statuts de pipeline, KPIs visuels.
- **📝 Journal de décisions** — log des choix stratégiques avec contexte. Précieux à 3-6 mois de recul.
- **⚙️ 100% paramétrable** — modèle IA, voix, instructions système, export/import.
- **📱 Installable comme app** sur ton téléphone (PWA).

## 🛠️ Stack

- HTML + CSS + JavaScript **vanilla** (zéro framework, zéro npm install)
- API OpenAI : `gpt-4o` / `whisper-1` / `tts-1`
- Stockage : `localStorage` du navigateur
- Service Worker pour mode hors-ligne et installation PWA

**Coût d'usage** : seulement ton API OpenAI (~5-15 $/mois pour ton usage CEO quotidien).

---

## 🚀 Installation (3 méthodes selon ton confort)

### Méthode 1 — Tester en local immédiatement (1 min, pas d'install)

⚠️ Pour que le **microphone fonctionne**, le fichier doit être servi en HTTPS ou via `localhost`. Ouvrir `index.html` en double-clic n'activera pas le micro.

**Sur Windows** (tu es habituée à Node grâce à Olfacode) :

```powershell
cd "C:\Users\Utilisateur\Desktop\super assistant\app"
npx http-server -p 8080 -c-1
```

Ou avec Python si déjà installé :
```powershell
cd "C:\Users\Utilisateur\Desktop\super assistant\app"
python -m http.server 8080
```

Puis ouvre **http://localhost:8080** dans Chrome ou Firefox.

### Méthode 2 — Déployer gratuit sur Render Static (recommandée pour mobile)

Pour avoir l'app **accessible depuis n'importe où** (PC, téléphone, partout dans le monde) :

1. Va sur https://render.com → New Static Site
2. Connecte un repo Git contenant ce dossier `app/` (ou crée un nouveau repo dédié)
3. Build command : *(laisse vide)*
4. Publish directory : `.` (la racine du repo)
5. Deploy → tu obtiens une URL `https://pilote-olfacode-tancia.onrender.com` (gratuite, HTTPS)

✓ Tu peux maintenant ouvrir cette URL sur ton téléphone, ajouter à l'écran d'accueil → c'est ton app.

### Méthode 3 — Déployer sur Netlify (encore plus rapide, en 30 sec)

1. Va sur https://app.netlify.com/drop
2. Glisse-dépose le dossier `app/` complet sur la page
3. Tu obtiens une URL instantanée gratuite

---

## 📱 Installer sur ton téléphone (PWA)

Une fois l'app accessible via une URL (méthode 2 ou 3) :

**iPhone / Safari** :
1. Ouvre l'URL dans Safari
2. Bouton "Partager" en bas → **"Sur l'écran d'accueil"**
3. L'icône Olfacode apparaît comme une vraie app
4. Au lancement, elle s'ouvre en plein écran, sans barre navigateur

**Android / Chrome** :
1. Ouvre l'URL dans Chrome
2. Menu (3 points) → **"Installer l'application"**
3. Pareil : raccourci sur ton écran d'accueil, plein écran

✓ Tu as désormais **Pilote Olfacode comme app native sur ton téléphone**.

---

## ⚙️ Configuration initiale (5 min)

À la première ouverture :

1. **Onglet "Réglages" → Clé API OpenAI**
   - Récupère ta clé sur https://platform.openai.com/api-keys
   - Colle-la → "Enregistrer"
   - **Sécurité critique** : sur https://platform.openai.com/account/limits, fixe un budget mensuel max (ex: 30 $) pour éviter toute facture choc

2. **Onglet "Réglages" → Choisir voix**
   - Teste les 6 voix avec le bouton "Tester"
   - Mon avis : **Nova** ou **Shimmer** pour un ton chaleureux français acceptable

3. **Onglet "Réglages" → Instructions système**
   - Déjà pré-remplies avec tout le contexte Olfacode
   - Personnalise si besoin (ton préféré, sujets sensibles à éviter, etc.)

4. **Onglet "Assistant"**
   - Premier essai : clique 🌅 **Brief du jour** ou parle au micro 🎙
   - L'assistant te répond en tenant compte de ta roadmap et budget

---

## 🎮 Usage quotidien recommandé

| Moment | Action | Durée |
|---|---|---|
| **Matin (8h)** | Clic 🌅 Brief → 3 priorités du jour | 3 min |
| **Pendant journée** | Question vocale ou écrite à la demande | 1-5 min |
| **Soir (19h)** | Clic 🌙 Bilan → recap + report | 5 min |
| **Vendredi 17h** | Revue hebdo avec l'assistant | 30 min |

## 🔐 Sécurité & vie privée

- **Tes données ne quittent jamais ton appareil**, sauf les requêtes que TU envoies à OpenAI (chat + transcription + voix).
- OpenAI conserve ces requêtes 30 jours (politique par défaut) puis les supprime. Tu peux opt-out via https://platform.openai.com/account/data-controls.
- Ta clé API est stockée dans `localStorage` (visible si quelqu'un accède à ton navigateur). **Verrouille ton téléphone et ton PC.**
- Export régulier de tes données via ⚙ Réglages → "Exporter (JSON)" — sauvegarde sur Drive ou clé USB.

## 🐛 Si quelque chose ne marche pas

- **Le micro ne marche pas** → tu as ouvert via `file://`. Utilise localhost ou déploie en HTTPS.
- **Erreur 401 / clé invalide** → ta clé OpenAI est expirée ou mal copiée. Vérifie sur platform.openai.com.
- **Réponse trop lente** → bascule en `gpt-4o-mini` dans Réglages (8x moins cher, qualité encore très bonne).
- **Données perdues** → si tu vidais le cache du navigateur, oui. Pour éviter ça, exporte chaque vendredi.

## 🛣️ Évolutions futures possibles

Si l'usage te convient et que tu veux passer au niveau supérieur :
- Synchro multi-appareils (mini backend Render, ~3-5 €/mois)
- Notifications push pour les deadlines proches (PWA Push API)
- Intégration directe Stripe webhook → KPI revenus auto-mis à jour
- Connecteur Notion (si tu veux conserver la duplication)
- Export PDF des revues hebdo

Ces évolutions ne sont pas nécessaires pour démarrer. Le MVP actuel est volontairement complet et autonome.

---

**Bonne navigation, capitaine.** 🚢
