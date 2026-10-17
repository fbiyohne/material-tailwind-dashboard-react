// Force la base de test AVANT tout import (dotenv ne surcharge pas les vars déjà définies).
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL || "postgresql://barreau:barreau_dev@127.0.0.1:5432/barreau_pn_test?schema=public";
process.env.JWT_SECRET = "test-secret";
process.env.NODE_ENV = "test";
// T10 : les suites existantes vérifient l'ancienne voie /api/verifier sur des documents créés à l'instant ;
// ils sont réputés antérieurs à la bascule. verification-courte.test.ts fixe sa propre date pour tester l'après.
process.env.VERIF_BASCULE = "2999-01-01";
