# Track record forward — registre horodaté

`ledger.json` est le **carnet de positions immuable** : chaque achat est inscrit à sa date de
décision avec son snapshot point-in-time (prix, note quanti, P/FCF, percentile, cap) + la note
qualitative (business model / management) capturée *live* à l'instant t.

## Pourquoi c'est opposable (et pas juste un fichier qu'on peut antidater)

Un commit git, à lui seul, ne prouve rien (les dates git sont falsifiables). La preuve réelle vient
de **`ledger.json.ots`** : un horodatage **OpenTimestamps** qui ancre le hash SHA-256 du registre
dans la blockchain Bitcoin. Personne — pas même nous — ne peut antidater ce hash : il est borné par
le temps du bloc Bitcoin qui le contient. Ça prouve mathématiquement que ce contenu **existait au
plus tard à cette date** → engagement *ex-ante*, sans biais de rétrospective.

## Workflow

1. Inscrire des achats : `tsx src/poc/forwardAdd.mts AAAA-MM-JJ T1 T2 …`
2. Notes quali : `tsx src/poc/forwardSetQual.mts AAAA-MM-JJ T1:BM/MGMT …`
3. **Horodater** : `./forward/stamp.sh stamp` → committer le nouveau `ledger.json.ots`
4. Plus tard : `./forward/stamp.sh upgrade` (ancrage Bitcoin), `./forward/stamp.sh verify`
5. Perf à la demande : `tsx src/poc/forwardPerf.mts`

## Limite (lecture honnête)

L'horodatage prouve l'**antériorité**, pas l'**exécution**. Pour une vente à un fonds, il faut en
plus un relevé de **courtier / administrateur tiers** (preuve qu'on a réellement détenu), une durée
significative (années), et un alpha ajusté du risque qui ne soit pas un simple facteur *value*.
