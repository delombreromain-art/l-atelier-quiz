# L’Atelier Quiz

Studio local de création de quiz vidéo YouTube. L’interface, le projet, les médias importés, les voix générées et les rendus restent dans le dossier du projet.

## Démarrer

Prérequis : Node.js 20.9 ou plus récent, Google Chrome ou Microsoft Edge installé, et `uv` pour installer le moteur vocal local la première fois.

```powershell
npm install
npm run setup:voice
npm run dev
```

Ouvrez [http://localhost:3000](http://localhost:3000). Le projet de démonstration comprend trois questions modifiables ; le bouton « Ajouter une question » permet d’en créer jusqu’à 60. Les changements sont enregistrés automatiquement dans `data/atelier-quiz.json`; les images, narrations et musique sont conservées dans `public/media`, `public/audio` et `public/music`; les vidéos sont rendues dans `data/exports`.

## Prototype vidéo

- Prévisualisation Remotion en 1920 × 1080, 30 FPS.
- La séquence d’introduction ouvre le quiz avant la première question. Chaque photo y apparaît seule en plein écran, avec un fondu et un léger zoom d’entrée et de sortie.
- Chaque question dure 12 secondes et sa réponse 1 seconde. Le passage vers la question suivante dure 1 seconde, y compris lors d’un changement de thème. La dernière question n’ajoute pas de transition finale.
- Le quiz accepte de 1 à 60 questions. Chaque question ajoutée garde le même cycle, et le thème plein écran de 4 secondes ouvre le quiz.
- Une introduction facultative accepte jusqu’à 1 000 caractères, lus avec la voix française sélectionnée. Les images du thème d’ouverture et des nouveaux thèmes sont présentées en plein écran ; des images supplémentaires peuvent être ajoutées. La séquence dure au moins 4 secondes et s’allonge selon la narration et le nombre d’images.
- Un nouveau thème peut être activé sur une question : sa photo s’insère brièvement avant elle avec le même fondu et zoom. Le fond global et le logo restent identiques d’un thème à l’autre et reviennent après la photo plein écran. Les questions suivantes héritent du thème jusqu’au prochain changement ; sans changement, seule la séquence photo d’ouverture apparaît.
- Import du fond global et du logo une seule fois, conservés pour toutes les questions et tous les thèmes. L’image d’illustration et le titre peuvent changer par thème ; le fond global ne change pas.
- Musique de fond globale importée une seule fois, jouée en boucle pendant tout le quiz. Son volume est réglable dans « Décor & logo » et s’abaisse automatiquement pendant les voix, avec une remontée douce lors des transitions et silences. Formats acceptés : MP3, WAV, M4A, AAC, OGG et WebM.
- Question et réponse apparaissent au même emplacement dans un cartouche sombre encadré d’or.
- Import facultatif d’une illustration par question, sans modifier les fichiers sources.
- Export local MP4 H.264 par Remotion, avec suivi du rendu et choix du chemin d’enregistrement après le rendu.
- Pour la narration, le prototype utilise Piper avec les voix françaises SIWIS (féminine) et UPMC (masculine). L’installation initiale télécharge les deux modèles dans `data/voices` et installe Python/Piper dans `.tools`; ensuite, les textes restent sur ce PC. Les WAV sont mis en cache local et réutilisés.

Si le rendu ne détecte pas Chrome ou Edge, définissez `REMOTION_CHROME_PATH` avec le chemin de l’exécutable avant de lancer `npm run dev`. L’application n’installe pas de navigateur dans le profil Windows.
