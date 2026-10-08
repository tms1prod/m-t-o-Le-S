# Météo · Le temps en clair

Application météo web et native basée sur React, Open-Meteo, Vite et Capacitor. `index.html` monte l’application définie dans `react.jsx`; Vite compile JSX avec le plugin React.

Les données Open-Meteo sont attribuées dans l’interface sous licence CC BY 4.0. L’offre gratuite est réservée à un usage non commercial (notamment sans publicité ni abonnement) et limitée à 10 000 requêtes par jour, 5 000 par heure et 600 par minute. Souscrire à une offre adaptée avant tout usage commercial. Voir [conditions Open-Meteo](https://open-meteo.com/en/terms).

Les icônes météo sont des SVG propres au projet. Les polices DM Sans et Manrope sont embarquées localement sous SIL Open Font License 1.1; voir [LICENSES.md](LICENSES.md).

## Développement

```sh
npm install
npm run dev
```

## Construire les applications

```sh
npm run cap:sync
npx cap add android
npx cap add ios
```

Ouvrir `android/` avec Android Studio pour générer et signer un AAB destiné à Google Play. Ouvrir `ios/` avec Xcode sur macOS pour configurer la signature et l’archive App Store. Après les réglages natifs, relancer `npm run cap:sync`.

## Avant publication

- L’identifiant `com.skeurprod.meteo` est configuré dans Capacitor, Android et iOS. Vérifier qu’il est disponible dans les deux stores avant publication; il ne devra ensuite plus changer.
- Les icônes raster Android/iOS et les icônes PWA sont générées. Il reste à créer des captures d’écran finales sur appareils ou simulateurs et à préparer les descriptions, catégories, âge cible et coordonnées de support des fiches de store.
- Les permissions iOS `NSLocationWhenInUseUsageDescription` et `NSLocationAlwaysAndWhenInUseUsageDescription` sont définies; Android déclare les permissions réseau et localisation approximative/précise. Tester le consentement sur appareils réels.
- Héberger `privacy.html` sur une URL publique, y inscrire l’identité légale et un contact, puis compléter les questionnaires App Privacy et Sécurité des données des stores.
- Les polices et icônes sont locales; Open-Meteo reste le seul service tiers de données nécessaire. Vérifier les conditions ci-dessus et les droits de redistribution si les ressources changent.
- Tester les versions signées sur appareils réels, y compris refus de localisation, absence de réseau et petits écrans.

La publication nécessite les comptes développeur Apple/Google, les certificats de signature, les informations d’éditeur, les métadonnées et la revue des stores. La génération et la signature iOS nécessitent macOS et Xcode.